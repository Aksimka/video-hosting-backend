import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePublishedVideoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parsedVideoId: number;

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
  @Min(1)
  publishedBy?: number;
}
