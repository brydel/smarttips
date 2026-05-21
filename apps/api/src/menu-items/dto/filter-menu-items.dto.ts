import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MenuItemCategory } from './create-menu-item.dto';

export class FilterMenuItemsDto {
  @ApiPropertyOptional({ enum: MenuItemCategory })
  @IsOptional()
  @IsEnum(MenuItemCategory, { message: 'error.validation.category.invalid' })
  categoryId?: MenuItemCategory;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean({ message: 'error.validation.active.invalid' })
  active?: boolean;
}
