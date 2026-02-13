import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class MapRawModelDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  canonicalModelId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mappedBy?: number;
}
