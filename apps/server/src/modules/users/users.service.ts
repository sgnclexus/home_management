import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { FirebaseConfigService } from '../../config/firebase.config';
import { 
  User, 
  UserDocument, 
  UpdateUserDto as IUpdateUserDto, 
  UpdateUserRoleDto as IUpdateUserRoleDto,
  UserProfileDto as IUserProfileDto,
  UserQueryParams,
  UserListResponse,
  UserRole,
  UserPermissions
} from '@home-management/types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { 
  validateCreateUserDto, 
  validateUpdateUserDto, 
  validateUserProfileDto,
  firestoreDocumentToUser,
  userToFirestoreDocument,
  validateUserDocument,
  createDefaultUserDocument,
  FIRESTORE_COLLECTIONS,
  USER_FIELD_PATHS,
  getUserPermissions,
  canManageUser
} from '@home-management/utils';
import { FieldValue } from 'firebase-admin/firestore';

@Injectable()
export class UsersService {
  constructor(private firebaseConfig: FirebaseConfigService) {}

  /**
   * Create a new user in Firestore
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Validate input data using the interface version
    const validation = validateCreateUserDto({
      ...createUserDto,
      role: createUserDto.role || UserRole.RESIDENT
    });
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const firestore = this.firebaseConfig.getFirestore();
    
    // Check if user already exists by email
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate UID if not provided
    const uid = createUserDto.uid || firestore.collection('temp').doc().id;

    // Create user document
    const userDocData = {
      ...createDefaultUserDocument(
        uid,
        createUserDto.email,
        createUserDto.displayName,
        createUserDto.role,
        createUserDto.preferredLanguage
      ),
      apartmentNumber: createUserDto.apartmentNumber,
      phoneNumber: createUserDto.phoneNumber,
    };

    const userRef = firestore.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    await userRef.set({
      ...userDocData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Retrieve the created user
    const createdDoc = await userRef.get();
    const createdUserDoc = createdDoc.data() as UserDocument;
    
    return firestoreDocumentToUser(createdUserDoc);
  }

  /**
   * Find user by Firebase UID
   */
  async findByUid(uid: string): Promise<User | null> {
    const firestore = this.firebaseConfig.getFirestore();
    const doc = await firestore.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid).get();
    
    if (!doc.exists) {
      return null;
    }

    const userData = doc.data() as UserDocument;
    if (!validateUserDocument(userData)) {
      throw new BadRequestException('Invalid user document structure');
    }

    return firestoreDocumentToUser(userData);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const firestore = this.firebaseConfig.getFirestore();
    const snapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.USERS)
      .where(USER_FIELD_PATHS.EMAIL, '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const userData = snapshot.docs[0].data() as UserDocument;
    if (!validateUserDocument(userData)) {
      throw new BadRequestException('Invalid user document structure');
    }

    return firestoreDocumentToUser(userData);
  }

  /**
   * Update user information
   */
  async update(uid: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Validate input data using the interface version
    const validation = validateUpdateUserDto(updateUserDto as IUpdateUserDto);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const firestore = this.firebaseConfig.getFirestore();
    const userRef = firestore.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    
    // Check if user exists
    const doc = await userRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User not found');
    }

    // Update user data
    const updateData: Partial<UserDocument> = {
      ...updateUserDto,
      updatedAt: FieldValue.serverTimestamp() as any,
    };

    await userRef.update(updateData);

    // Return updated user
    const updatedDoc = await userRef.get();
    const updatedUserDoc = updatedDoc.data() as UserDocument;
    
    return firestoreDocumentToUser(updatedUserDoc);
  }

  /**
   * Update user role (admin only)
   */
  async updateRole(uid: string, updateRoleDto: UpdateUserRoleDto, currentUserRole: UserRole): Promise<User> {
    const firestore = this.firebaseConfig.getFirestore();
    const userRef = firestore.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    
    // Check if current user can manage users
    if (!canManageUser(currentUserRole, updateRoleDto.role)) {
      throw new BadRequestException('Insufficient permissions to update user role');
    }

    // Check if user exists
    const doc = await userRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User not found');
    }

    // Update role and timestamp
    await userRef.update({
      role: updateRoleDto.role,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Return updated user
    const updatedDoc = await userRef.get();
    const updatedUserDoc = updatedDoc.data() as UserDocument;
    
    return firestoreDocumentToUser(updatedUserDoc);
  }

  /**
   * Update user profile (self-service)
   */
  async updateProfile(uid: string, profileDto: UserProfileDto): Promise<User> {
    // Validate input data using the interface version
    const validation = validateUserProfileDto(profileDto as IUserProfileDto);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const firestore = this.firebaseConfig.getFirestore();
    const userRef = firestore.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    
    // Check if user exists
    const doc = await userRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User not found');
    }

    // Update profile data
    await userRef.update({
      ...profileDto,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Return updated user
    const updatedDoc = await userRef.get();
    const updatedUserDoc = updatedDoc.data() as UserDocument;
    
    return firestoreDocumentToUser(updatedUserDoc);
  }

  /**
   * Deactivate user
   */
  async deactivate(uid: string): Promise<void> {
    const firestore = this.firebaseConfig.getFirestore();
    const userRef = firestore.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    
    // Check if user exists
    const doc = await userRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User not found');
    }

    // Deactivate user
    await userRef.update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /**
   * Reactivate user
   */
  async reactivate(uid: string): Promise<void> {
    const firestore = this.firebaseConfig.getFirestore();
    const userRef = firestore.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    
    // Check if user exists
    const doc = await userRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User not found');
    }

    // Reactivate user
    await userRef.update({
      isActive: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /**
   * Get users with pagination and filtering
   */
  async findAll(queryParams: UserQueryParams): Promise<UserListResponse> {
    const firestore = this.firebaseConfig.getFirestore();
    let query = firestore.collection(FIRESTORE_COLLECTIONS.USERS) as any;

    // Apply filters
    if (queryParams.role) {
      query = query.where(USER_FIELD_PATHS.ROLE, '==', queryParams.role);
    }

    if (queryParams.isActive !== undefined) {
      query = query.where(USER_FIELD_PATHS.IS_ACTIVE, '==', queryParams.isActive);
    }

    if (queryParams.apartmentNumber) {
      query = query.where(USER_FIELD_PATHS.APARTMENT_NUMBER, '==', queryParams.apartmentNumber);
    }

    // Apply sorting
    const sortBy = queryParams.sortBy || USER_FIELD_PATHS.CREATED_AT;
    const sortOrder = queryParams.sortOrder || 'desc';
    query = query.orderBy(sortBy, sortOrder);

    // Apply pagination
    const limit = queryParams.limit || 10;
    const offset = ((queryParams.page || 1) - 1) * limit;
    
    if (offset > 0) {
      query = query.offset(offset);
    }
    query = query.limit(limit);

    // Execute query
    const snapshot = await query.get();
    const users = snapshot.docs
      .map(doc => doc.data() as UserDocument)
      .filter(validateUserDocument)
      .map(firestoreDocumentToUser);

    // Get total count for pagination
    let countQuery = firestore.collection(FIRESTORE_COLLECTIONS.USERS) as any;
    if (queryParams.role) {
      countQuery = countQuery.where(USER_FIELD_PATHS.ROLE, '==', queryParams.role);
    }
    if (queryParams.isActive !== undefined) {
      countQuery = countQuery.where(USER_FIELD_PATHS.IS_ACTIVE, '==', queryParams.isActive);
    }
    if (queryParams.apartmentNumber) {
      countQuery = countQuery.where(USER_FIELD_PATHS.APARTMENT_NUMBER, '==', queryParams.apartmentNumber);
    }

    const countSnapshot = await countQuery.get();
    const total = countSnapshot.size;

    return {
      users,
      total,
      page: queryParams.page || 1,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all users by role
   */
  async findByRole(role: UserRole): Promise<User[]> {
    const firestore = this.firebaseConfig.getFirestore();
    const snapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.USERS)
      .where(USER_FIELD_PATHS.ROLE, '==', role)
      .where(USER_FIELD_PATHS.IS_ACTIVE, '==', true)
      .get();

    return snapshot.docs
      .map(doc => doc.data() as UserDocument)
      .filter(validateUserDocument)
      .map(firestoreDocumentToUser);
  }

  /**
   * Get all active users
   */
  async findAllActive(): Promise<User[]> {
    const firestore = this.firebaseConfig.getFirestore();
    const snapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.USERS)
      .where(USER_FIELD_PATHS.IS_ACTIVE, '==', true)
      .get();

    return snapshot.docs
      .map(doc => doc.data() as UserDocument)
      .filter(validateUserDocument)
      .map(firestoreDocumentToUser);
  }

  /**
   * Alias for findAllActive - used by notification service
   */
  async findActiveUsers(): Promise<User[]> {
    return this.findAllActive();
  }

  /**
   * Search users by display name or email
   */
  async search(searchTerm: string, limit: number = 10): Promise<User[]> {
    const firestore = this.firebaseConfig.getFirestore();
    
    // Search by display name (case-insensitive prefix match)
    const nameSnapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.USERS)
      .where(USER_FIELD_PATHS.DISPLAY_NAME, '>=', searchTerm)
      .where(USER_FIELD_PATHS.DISPLAY_NAME, '<=', searchTerm + '\uf8ff')
      .where(USER_FIELD_PATHS.IS_ACTIVE, '==', true)
      .limit(limit)
      .get();

    // Search by email (case-insensitive prefix match)
    const emailSnapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.USERS)
      .where(USER_FIELD_PATHS.EMAIL, '>=', searchTerm.toLowerCase())
      .where(USER_FIELD_PATHS.EMAIL, '<=', searchTerm.toLowerCase() + '\uf8ff')
      .where(USER_FIELD_PATHS.IS_ACTIVE, '==', true)
      .limit(limit)
      .get();

    // Combine and deduplicate results
    const userMap = new Map<string, User>();
    
    [...nameSnapshot.docs, ...emailSnapshot.docs].forEach(doc => {
      const userData = doc.data() as UserDocument;
      if (validateUserDocument(userData)) {
        const user = firestoreDocumentToUser(userData);
        userMap.set(user.uid, user);
      }
    });

    return Array.from(userMap.values()).slice(0, limit);
  }

  /**
   * Get user permissions based on role
   */
  async getUserPermissions(uid: string): Promise<UserPermissions> {
    const user = await this.findByUid(uid);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return getUserPermissions(user.role);
  }

  /**
   * Update FCM token for push notifications
   */
  async updateFcmToken(uid: string, fcmToken: string): Promise<void> {
    const firestore = this.firebaseConfig.getFirestore();
    const userRef = firestore.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    
    // Check if user exists
    const doc = await userRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User not found');
    }

    // Update FCM token
    await userRef.update({
      fcmToken,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /**
   * Remove FCM token (on logout)
   */
  async removeFcmToken(uid: string): Promise<void> {
    const firestore = this.firebaseConfig.getFirestore();
    const userRef = firestore.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    
    // Check if user exists
    const doc = await userRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User not found');
    }

    // Remove FCM token
    await userRef.update({
      fcmToken: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}