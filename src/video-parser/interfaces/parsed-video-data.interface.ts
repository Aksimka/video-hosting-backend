import { ParserVideoSite } from '../enums/parser-video-site.enum';
import { ParserTagType } from '../enums/parser-tag-type.enum';

export interface ParsedTagData {
  name: string;
  slug: string;
  type: ParserTagType;
  groupLabel?: string;
}

export interface ParsedModelData {
  name: string;
  slug: string;
}

export interface ParsedVideoCategoryItem {
  pageUrl: string;
  mediaId?: string;
  title?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
}

export interface ParsedCategoryResult {
  site: ParserVideoSite;
  categoryUrl: string;
  items: ParsedVideoCategoryItem[];
}

export interface ParsedVideoData {
  site: ParserVideoSite;
  pageUrl: string;
  categoryUrl?: string;
  pageSlugId?: string;
  mediaId?: string;
  title: string;
  description?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  posterUrl?: string;
  trailerMp4Url?: string;
  trailerWebmUrl?: string;
  playerSourceUrl?: string;
  directVideoUrl?: string;
  directVideoExpiresAt?: Date;
  timelineSpriteTemplateUrl?: string;
  tags: ParsedTagData[];
  models: ParsedModelData[];
}
