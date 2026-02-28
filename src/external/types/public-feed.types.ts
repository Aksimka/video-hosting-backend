export type PublicFeedOperation = 'upsert' | 'delete';

export type PublicFeedCursor = {
  updatedAt: string;
  id: number;
};

export type PublicFeedUpsertPayload = {
  id: number;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  playerSourceUrl: string;
  directVideoUrl: string | null;
  directVideoExpiresAt: Date | null;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  trailerMp4Url: string | null;
  trailerWebmUrl: string | null;
  timelineSpriteTemplateUrl: string | null;
  publishedAt: Date | null;
  site: string;
  pageUrl: string;
};

export type PublicFeedItem = {
  operation: PublicFeedOperation;
  entityId: number;
  cursor: PublicFeedCursor;
  payload: PublicFeedUpsertPayload | null;
};

export type PublicFeedResponse = {
  items: PublicFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};
