import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreatePublishedVideoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parsedVideoId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  publishedBy?: number;
}
