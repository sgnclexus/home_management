import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ValidationException } from '../exceptions/custom.exceptions';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Transform the object to the target type
      validateCustomDecorators: true,
    });

    if (errors.length > 0) {
      const validationErrors = this.formatValidationErrors(errors);
      throw new ValidationException('Validation failed', validationErrors);
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatValidationErrors(errors: any[]): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    
    errors.forEach(error => {
      if (error.constraints) {
        result[error.property] = Object.values(error.constraints);
      }
      
      if (error.children && error.children.length > 0) {
        const childErrors = this.formatValidationErrors(error.children);
        Object.keys(childErrors).forEach(key => {
          result[`${error.property}.${key}`] = childErrors[key];
        });
      }
    });
    
    return result;
  }
}