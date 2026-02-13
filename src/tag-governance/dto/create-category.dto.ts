import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CategoryMatchMode } from '../enums/category-match-mode.enum';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(256)
  name: string;

  @IsString()
  @MaxLength(256)
  slug: string;

  @IsOptional()
  @IsEnum(CategoryMatchMode)
  matchMode?: CategoryMatchMode;

  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  canonicalTagIds: number[];
}
