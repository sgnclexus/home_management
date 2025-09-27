import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { FirebaseConfigService } from '../../config/firebase.config';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserRole } from '@home-management/types';

@Injectable()
export class AuthService {
  constructor(
    private firebaseConfig: FirebaseConfigService,
    private usersService: UsersService,
  ) {}

  /**
   * Verify Firebase ID token and return decoded token
   */
  async verifyToken(idToken: string) {
    try {
      const decodedToken = await this.firebaseConfig.getAuth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Register a new user after Firebase authentication
   */
  async registerUser(uid: string, userData: CreateUserDto) {
    try {
      // Check if user already exists
      const existingUser = await this.usersService.findByUid(uid);
      if (existingUser) {
        throw new BadRequestException('User already registered');
      }

      // Create user profile in database
      const user = await this.usersService.create({
        ...userData,
        uid,
        role: UserRole.RESIDENT, // Default role for new users
        isActive: true,
      });

      return user;
    } catch (error) {
      console.error('User registration failed:', error);
      throw error;
    }
  }

  /**
   * Get user profile by Firebase UID
   */
  async getUserProfile(uid: string) {
    try {
      const user = await this.usersService.findByUid(uid);
      if (!user) {
        throw new UnauthorizedException('User profile not found');
      }
      return user;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw error;
    }
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(uid: string, role: UserRole, currentUserRole: UserRole) {
    try {
      const user = await this.usersService.updateRole(uid, { role }, currentUserRole);
      return user;
    } catch (error) {
      console.error('Failed to update user role:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(uid: string) {
    try {
      // Deactivate in database
      await this.usersService.deactivate(uid);
      
      // Disable user in Firebase Auth
      await this.firebaseConfig.getAuth().updateUser(uid, {
        disabled: true,
      });

      return { message: 'User deactivated successfully' };
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      throw error;
    }
  }

  /**
   * Reactivate user account
   */
  async reactivateUser(uid: string) {
    try {
      // Reactivate in database
      await this.usersService.reactivate(uid);
      
      // Enable user in Firebase Auth
      await this.firebaseConfig.getAuth().updateUser(uid, {
        disabled: false,
      });

      return { message: 'User reactivated successfully' };
    } catch (error) {
      console.error('Failed to reactivate user:', error);
      throw error;
    }
  }
}