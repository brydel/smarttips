import { PartialType, OmitType } from '@nestjs/mapped-types';
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

function IsNonEmptyObject(validationOptions?: ValidationOptions) {
  return function (target: object) {
    registerDecorator({
      name: 'isNonEmptyObject',
      target: target.constructor,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          return Object.keys(obj).filter((k) => obj[k] !== undefined).length > 0;
        },
        defaultMessage() {
          return 'error.validation.update.emptyPayload';
        },
      },
      propertyName: '',
    });
  };
}

@IsNonEmptyObject()
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['hireDate'] as const),
) {}
