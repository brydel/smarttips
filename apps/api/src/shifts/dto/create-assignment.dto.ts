import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeRole } from '@prisma/client';
import { IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({
    example: '8dfdb4e4-089f-4477-8e17-f3ffb320a1f8',
  })
  @IsUUID('4')
  readonly employeeId!: string;

  @ApiPropertyOptional({
    enum: EmployeeRole,
    description: 'Rôle pendant le shift. Si absent, le rôle actuel de l’employé sera utilisé.',
  })
  @IsOptional()
  @IsEnum(EmployeeRole)
  readonly roleDuringShift?: EmployeeRole;

  @ApiProperty({
    example: 6.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(24)
  readonly scheduledHours!: number;

  @ApiPropertyOptional({
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  readonly breakMinutes?: number;
}
