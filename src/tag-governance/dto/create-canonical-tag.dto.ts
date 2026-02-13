import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCanonicalTagDto {
  @IsString()
  @MaxLength(256)
  name: string;

  @IsString()
  @MaxLength(256)
  slug: string;

  @IsOptional()
  isActive?: boolean;
}
