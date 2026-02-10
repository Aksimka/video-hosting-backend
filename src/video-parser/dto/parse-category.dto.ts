import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class ParseCategoryDto {
  @IsString()
  @IsUrl({ require_protocol: true })
  url: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pages?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hydrateVideos?: boolean;
}
