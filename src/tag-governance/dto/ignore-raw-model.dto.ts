import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class IgnoreRawModelDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mappedBy?: number;
}
