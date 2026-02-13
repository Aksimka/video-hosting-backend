import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCanonicalModelDto {
  @IsString()
  @MaxLength(256)
  name: string;

  @IsString()
  @MaxLength(256)
  slug: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
