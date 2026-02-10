import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class ParseVideoPageDto {
  @IsString()
  @IsUrl({ require_protocol: true })
  url: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  categoryUrl?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  forceRefreshSources?: boolean;
}
