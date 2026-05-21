import { PartialType } from '@nestjs/mapped-types';
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { CreateMenuItemDto } from './create-menu-item.dto';

function IsNonEmptyObject(validationOptions?: ValidationOptions) {
  return function (target: object) {
    registerDecorator({
      name: 'isNonEmptyObject',
      target: target.constructor,
      options: validationOptions,
      propertyName: '',
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          return Object.keys(obj).filter((k) => obj[k] !== undefined).length > 0;
        },
        defaultMessage() {
          return 'error.validation.update.emptyPayload';
        },
      },
    });
  };
}

@IsNonEmptyObject()
export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {}
