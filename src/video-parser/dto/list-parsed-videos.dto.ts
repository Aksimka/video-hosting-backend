import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ParsedVideosPublicationState } from '../enums/parsed-videos-publication-state.enum';

export class ListParsedVideosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsEnum(ParsedVideosPublicationState)
  publicationState?: ParsedVideosPublicationState;
}
