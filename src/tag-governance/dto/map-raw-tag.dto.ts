import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class MapRawTagDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  canonicalTagId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mappedBy?: number;
}
