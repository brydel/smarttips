import { IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterMenuItemsDto {
  /**
   * UUID de la catégorie (PK de MenuCategory).
   * Le champ était validé par enum — corrigé : le filtre Prisma utilise l'UUID FK.
   */
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrer par catégorie (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'error.validation.categoryId.invalid' })
  categoryId?: string;

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
