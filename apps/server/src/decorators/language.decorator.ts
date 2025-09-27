import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { I18nService, SupportedLanguage } from '../services/i18n.service';

export const Language = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): SupportedLanguage => {
    const request = ctx.switchToHttp().getRequest();
    const i18nService = new I18nService();
    
    // Try to get language from user preferences first
    if (request.user?.preferredLanguage) {
      return i18nService.getUserLanguage(request.user);
    }
    
    // Fall back to Accept-Language header
    const acceptLanguage = request.headers['accept-language'];
    return i18nService.detectLanguage(acceptLanguage);
  },
);