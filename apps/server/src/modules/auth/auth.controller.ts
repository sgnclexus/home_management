import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
  Patch,
  Param
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser, CurrentUserProfile } from '../../decorators/current-user.decorator';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserRoleDto } from '../users/dto/update-user-role.dto';

enum UserRole {
  ADMIN = 'admin',
  VIGILANCE = 'vigilance',
  RESIDENT = 'resident',
  SECURITY = 'security',
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('status')
  getAuthStatus() {
    return {
      message: 'Auth service is running',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Register a new user after Firebase authentication
   */
  @Post('register')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async register(
    @CurrentUser() firebaseUser: any,
    @Body() createUserDto: CreateUserDto,
  ) {
    const user = await this.authService.registerUser(firebaseUser.uid, createUserDto);
    return {
      message: 'User registered successfully',
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  /**
   * Get current user profile
   */
  @Get('profile')
  @UseGuards(FirebaseAuthGuard)
  async getProfile(@CurrentUser() firebaseUser: any) {
    const user = await this.authService.getUserProfile(firebaseUser.uid);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      apartmentNumber: user.apartmentNumber,
      phoneNumber: user.phoneNumber,
      preferredLanguage: user.preferredLanguage,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update user role (admin only)
   */
  @Patch('users/:uid/role')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateUserRole(
    @Param('uid') uid: string,
    @Body() updateRoleDto: UpdateUserRoleDto,
    @CurrentUser() currentUser: any,
  ) {
    const user = await this.authService.updateUserRole(uid, updateRoleDto.role, currentUser.role);
    return {
      message: 'User role updated successfully',
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }

  /**
   * Deactivate user account (admin only)
   */
  @Patch('users/:uid/deactivate')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deactivateUser(@Param('uid') uid: string) {
    return await this.authService.deactivateUser(uid);
  }

  /**
   * Reactivate user account (admin only)
   */
  @Patch('users/:uid/reactivate')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reactivateUser(@Param('uid') uid: string) {
    return await this.authService.reactivateUser(uid);
  }
}