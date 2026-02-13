import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCanonicalModelDto {
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
