import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PublishedVideo } from 'src/published-videos/published-video.entity';
import { PublishedVideoStatus } from 'src/published-videos/enums/published-video-status.enum';
import { Category } from 'src/tag-governance/entities/category.entity';
import { ListPublicFeedDto } from './dto/list-public-feed.dto';
import { ExternalCategoryItem } from './types/external-category.types';
import {
  PublicFeedCursor,
  PublicFeedItem,
  PublicFeedOperation,
  PublicFeedResponse,
  PublicFeedUpsertPayload,
} from './types/public-feed.types';

@Injectable()
export class ExternalService {
  constructor(
    @InjectRepository(PublishedVideo)
    private readonly publishedVideosRepository: Repository<PublishedVideo>,
    @InjectRepository(Category, 'tags')
    private readonly categoryRepository: Repository<Category>,
  ) {}

  /** Возвращает инкрементальный фид опубликованных видео для внешнего public-контура. */
  async getPublicFeed(query: ListPublicFeedDto): Promise<PublicFeedResponse> {
    const limit = query.limit ?? 100;
    const cursor = this.decodePublicFeedCursor(query.cursor);

    const qb = this.publishedVideosRepository
      .createQueryBuilder('published_videos')
      .orderBy('published_videos.updated_at', 'ASC')
      .addOrderBy('published_videos.id', 'ASC')
      .take(limit + 1);

    if (cursor) {
      qb.where(
        new Brackets((subQb) => {
          subQb.where('published_videos.updated_at > :cursorUpdatedAt', {
            cursorUpdatedAt: cursor.updatedAt,
          });
          subQb.orWhere(
            'published_videos.updated_at = :cursorUpdatedAt AND published_videos.id > :cursorId',
            {
              cursorUpdatedAt: cursor.updatedAt,
              cursorId: cursor.id,
            },
          );
        }),
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((row) =>
      this.mapPublicFeedItem(row),
    );

    const nextCursor =
      items.length > 0
        ? this.encodePublicFeedCursor(items[items.length - 1].cursor)
        : null;

    return {
      items,
      nextCursor,
      hasMore,
      limit,
    };
  }

  /** Возвращает полный snapshot активных категорий для внешнего public-контура. */
  async getActiveCategories(): Promise<ExternalCategoryItem[]> {
    const categories = await this.categoryRepository.find({
      where: { is_active: true },
      order: { name: 'ASC', id: 'ASC' },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      updatedAt: category.updated_at,
    }));
  }

  /** Формирует одну запись фида: upsert для published, delete для hidden/unpublished. */
  private mapPublicFeedItem(video: PublishedVideo): PublicFeedItem {
    const operation: PublicFeedOperation =
      video.status === PublishedVideoStatus.PUBLISHED ? 'upsert' : 'delete';

    return {
      operation,
      entityId: video.id,
      cursor: {
        updatedAt: video.updated_at.toISOString(),
        id: video.id,
      },
      payload: operation === 'upsert' ? this.mapPublicFeedPayload(video) : null,
    };
  }

  /** Преобразует snapshot published-video в payload для read-model public контура. */
  private mapPublicFeedPayload(video: PublishedVideo): PublicFeedUpsertPayload {
    return {
      id: video.id,
      title: video.title,
      description: video.description,
      durationSeconds: video.duration_seconds,
      playerSourceUrl: video.player_source_url,
      directVideoUrl: video.direct_video_url,
      directVideoExpiresAt: video.direct_video_expires_at,
      thumbnailUrl: video.thumbnail_url,
      posterUrl: video.poster_url,
      trailerMp4Url: video.trailer_mp4_url,
      trailerWebmUrl: video.trailer_webm_url,
      timelineSpriteTemplateUrl: video.timeline_sprite_template_url,
      publishedAt: video.published_at,
      site: video.site,
      pageUrl: video.page_url,
    };
  }

  /** Кодирует cursor в base64url-строку для последующего инкрементального чтения. */
  private encodePublicFeedCursor(cursor: PublicFeedCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  /** Декодирует cursor и валидирует его структуру. */
  private decodePublicFeedCursor(cursorRaw?: string): PublicFeedCursor | null {
    if (!cursorRaw) {
      return null;
    }

    try {
      const json = Buffer.from(cursorRaw, 'base64url').toString('utf8');
      const parsed = JSON.parse(json) as Partial<PublicFeedCursor>;

      if (
        !parsed ||
        typeof parsed.updatedAt !== 'string' ||
        parsed.updatedAt.length === 0 ||
        typeof parsed.id !== 'number' ||
        !Number.isInteger(parsed.id) ||
        parsed.id < 1
      ) {
        throw new Error('Invalid cursor shape');
      }

      return {
        updatedAt: parsed.updatedAt,
        id: parsed.id,
      };
    } catch {
      throw new BadRequestException('Invalid public feed cursor');
    }
  }
}
