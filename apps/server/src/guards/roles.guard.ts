import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UsersService } from '../modules/users/users.service';

enum UserRole {
  ADMIN = 'admin',
  VIGILANCE = 'vigilance',
  RESIDENT = 'resident',
  SECURITY = 'security',
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No roles required, allow access
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    try {
      // Get user role from database
      const userProfile = await this.usersService.findByUid(user.uid);
      
      if (!userProfile) {
        throw new ForbiddenException('User profile not found');
      }

      // Check if user has any of the required roles
      const hasRole = requiredRoles.includes(userProfile.role);
      
      if (!hasRole) {
        throw new ForbiddenException(
          `Access denied. Required roles: ${requiredRoles.join(', ')}`
        );
      }

      // Add user profile to request for use in controllers
      request.userProfile = userProfile;
      
      return true;
    } catch (error) {
      console.error('Role verification failed:', error);
      throw new ForbiddenException('Access denied');
    }
  }
}