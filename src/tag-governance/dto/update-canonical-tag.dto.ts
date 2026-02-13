import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCanonicalTagDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  slug?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
