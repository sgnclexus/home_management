import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseConfigService } from '../config/firebase.config';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private firebaseConfig: FirebaseConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      // Verify the Firebase ID token
      const decodedToken = await this.firebaseConfig.getAuth().verifyIdToken(token);
      
      // Add the decoded token to the request object
      request.user = decodedToken;
      
      return true;
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}