import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Patch,
  Delete,
  Body, 
  Param, 
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException
} from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { UserRole, User } from '@home-management/types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { FcmTokenDto } from './dto/fcm-token.dto';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Create a new user (Admin only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  /**
   * Get all users with pagination and filtering (Admin and Vigilance)
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  /**
   * Search users (Admin and Vigilance)
   */
  @Get('search')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async search(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number
  ) {
    if (!searchTerm) {
      throw new BadRequestException('Search term is required');
    }
    return this.usersService.search(searchTerm, limit);
  }

  /**
   * Get users by role (Admin and Vigilance)
   */
  @Get('role/:role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async findByRole(@Param('role') role: UserRole): Promise<User[]> {
    return this.usersService.findByRole(role);
  }

  /**
   * Get current user profile
   */
  @Get('me')
  async getCurrentUser(@CurrentUser() user: User): Promise<User> {
    return user;
  }

  /**
   * Get current user permissions
   */
  @Get('me/permissions')
  async getCurrentUserPermissions(@CurrentUser() user: User) {
    return this.usersService.getUserPermissions(user.uid);
  }

  /**
   * Update current user profile
   */
  @Put('me')
  async updateCurrentUserProfile(
    @CurrentUser() user: User,
    @Body() profileDto: UserProfileDto
  ): Promise<User> {
    return this.usersService.updateProfile(user.uid, profileDto);
  }

  /**
   * Update FCM token for current user
   */
  @Patch('me/fcm-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateFcmToken(
    @CurrentUser() user: User,
    @Body() fcmTokenDto: FcmTokenDto
  ): Promise<void> {
    return this.usersService.updateFcmToken(user.uid, fcmTokenDto.fcmToken);
  }

  /**
   * Remove FCM token for current user
   */
  @Delete('me/fcm-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFcmToken(@CurrentUser() user: User): Promise<void> {
    return this.usersService.removeFcmToken(user.uid);
  }

  /**
   * Get user by ID (Admin and Vigilance)
   */
  @Get(':uid')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async findOne(@Param('uid') uid: string): Promise<User> {
    const user = await this.usersService.findByUid(uid);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  /**
   * Update user (Admin only)
   */
  @Put(':uid')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('uid') uid: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<User> {
    return this.usersService.update(uid, updateUserDto);
  }

  /**
   * Update user role (Admin only)
   */
  @Patch(':uid/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateRole(
    @Param('uid') uid: string,
    @Body() updateRoleDto: UpdateUserRoleDto,
    @CurrentUser() currentUser: User
  ): Promise<User> {
    return this.usersService.updateRole(uid, updateRoleDto, currentUser.role);
  }

  /**
   * Deactivate user (Admin only)
   */
  @Patch(':uid/deactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param('uid') uid: string): Promise<void> {
    return this.usersService.deactivate(uid);
  }

  /**
   * Reactivate user (Admin only)
   */
  @Patch(':uid/reactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reactivate(@Param('uid') uid: string): Promise<void> {
    return this.usersService.reactivate(uid);
  }

  /**
   * Get user permissions (Admin and Vigilance)
   */
  @Get(':uid/permissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async getUserPermissions(@Param('uid') uid: string) {
    return this.usersService.getUserPermissions(uid);
  }

  /**
   * Health check endpoint
   */
  @Get('health/status')
  getUsersStatus() {
    return {
      message: 'Users service is running',
      timestamp: new Date().toISOString(),
    };
  }
}