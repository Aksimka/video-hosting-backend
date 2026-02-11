import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { PublishedVideoStatus } from '../enums/published-video-status.enum';

export class UpdatePublishedVideoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  posterUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  trailerMp4Url?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  trailerWebmUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  timelineSpriteTemplateUrl?: string;

  @IsOptional()
  @IsEnum(PublishedVideoStatus)
  status?: PublishedVideoStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  publishedBy?: number;
}
