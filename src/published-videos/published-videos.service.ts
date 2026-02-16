import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PublishedVideo } from './published-video.entity';
import { ParsedVideo } from 'src/video-parser/entities/parsed-video.entity';
import { CreatePublishedVideoDto } from './dto/create-published-video.dto';
import { UpdatePublishedVideoDto } from './dto/update-published-video.dto';
import { ParsedVideoSource } from 'src/video-parser/entities/parsed-video-source.entity';
import { ParserVideoSourceType } from 'src/video-parser/enums/parser-video-source-type.enum';
import { PublishedVideoStatus } from './enums/published-video-status.enum';
import { TagGovernanceService } from 'src/tag-governance/tag-governance.service';
import { ParsedVideoStatus } from 'src/video-parser/enums/parsed-video-status.enum';
import { ListPublicFeedDto } from './dto/list-public-feed.dto';
import {
  PublicFeedCursor,
  PublicFeedItem,
  PublicFeedOperation,
  PublicFeedResponse,
  PublicFeedUpsertPayload,
} from './types/public-feed.types';

@Injectable()
export class PublishedVideosService {
  constructor(
    @InjectRepository(PublishedVideo)
    private readonly publishedVideosRepository: Repository<PublishedVideo>,
    @InjectRepository(ParsedVideo)
    private readonly parsedVideosRepository: Repository<ParsedVideo>,
    private readonly tagGovernanceService: TagGovernanceService,
  ) {}

  /** Публикует видео из parsed-слоя после проверки готовности governance. */
  async createFromParsed(
    dto: CreatePublishedVideoDto,
  ): Promise<PublishedVideo> {
    await this.tagGovernanceService.assertParsedVideoReadyForPublish(
      dto.parsedVideoId,
    );

    const { parsedVideo, playerSource, directSource } =
      await this.getParsedVideoForPublish(dto.parsedVideoId);

    const existing = await this.publishedVideosRepository.findOneBy({
      parsed_video_id: parsedVideo.id,
    });

    const publishedVideo =
      existing ||
      this.publishedVideosRepository.create({
        parsed_video_id: parsedVideo.id,
      });

    this.applySnapshot(publishedVideo, parsedVideo, playerSource, directSource);
    this.applyCreateOverrides(publishedVideo, dto);
    publishedVideo.status = PublishedVideoStatus.PUBLISHED;
    publishedVideo.published_at = publishedVideo.published_at || new Date();
    if (dto.publishedBy !== undefined) {
      publishedVideo.published_by = dto.publishedBy;
    }

    const savedPublishedVideo =
      await this.publishedVideosRepository.save(publishedVideo);
    await this.setParsedVideoStatus(
      parsedVideo.id,
      ParsedVideoStatus.PUBLISHED,
    );

    return savedPublishedVideo;
  }

  /** Возвращает список опубликованных сущностей, опционально по статусу. */
  async findAll(status?: PublishedVideoStatus): Promise<PublishedVideo[]> {
    return this.publishedVideosRepository.find({
      where: status ? { status } : undefined,
      order: { updated_at: 'DESC' },
    });
  }

  /** Возвращает одну запись опубликованного видео для админки. */
  async findOne(id: number): Promise<PublishedVideo> {
    const video = await this.publishedVideosRepository.findOneBy({ id });
    if (!video) {
      throw new NotFoundException(`Published video with id ${id} not found`);
    }

    return video;
  }

  /** Частично обновляет snapshot и статус опубликованного видео. */
  async update(
    id: number,
    dto: UpdatePublishedVideoDto,
  ): Promise<PublishedVideo> {
    const video = await this.findOne(id);

    if (dto.title !== undefined) {
      video.title = dto.title;
    }
    if (dto.description !== undefined) {
      video.description = dto.description;
    }
    if (dto.durationSeconds !== undefined) {
      video.duration_seconds = dto.durationSeconds;
    }
    if (dto.thumbnailUrl !== undefined) {
      video.thumbnail_url = dto.thumbnailUrl;
    }
    if (dto.posterUrl !== undefined) {
      video.poster_url = dto.posterUrl;
    }
    if (dto.trailerMp4Url !== undefined) {
      video.trailer_mp4_url = dto.trailerMp4Url;
    }
    if (dto.trailerWebmUrl !== undefined) {
      video.trailer_webm_url = dto.trailerWebmUrl;
    }
    if (dto.timelineSpriteTemplateUrl !== undefined) {
      video.timeline_sprite_template_url = dto.timelineSpriteTemplateUrl;
    }
    if (dto.status !== undefined) {
      if (dto.status === PublishedVideoStatus.PUBLISHED) {
        await this.tagGovernanceService.assertParsedVideoReadyForPublish(
          video.parsed_video_id,
        );
      }
      video.status = dto.status;
      if (
        dto.status === PublishedVideoStatus.PUBLISHED &&
        video.published_at === null
      ) {
        video.published_at = new Date();
      }
    }
    if (dto.publishedBy !== undefined) {
      video.published_by = dto.publishedBy;
    }

    const savedVideo = await this.publishedVideosRepository.save(video);
    if (dto.status !== undefined) {
      await this.setParsedVideoStatus(
        savedVideo.parsed_video_id,
        savedVideo.status === PublishedVideoStatus.PUBLISHED
          ? ParsedVideoStatus.PUBLISHED
          : ParsedVideoStatus.PARSED,
      );
    }

    return savedVideo;
  }

  /** Переводит опубликованное видео в скрытый статус. */
  async hide(id: number): Promise<PublishedVideo> {
    const video = await this.findOne(id);
    video.status = PublishedVideoStatus.HIDDEN;
    const savedVideo = await this.publishedVideosRepository.save(video);
    await this.setParsedVideoStatus(
      savedVideo.parsed_video_id,
      ParsedVideoStatus.PARSED,
    );
    return savedVideo;
  }

  /** Пересобирает snapshot опубликованного видео из текущего parsed состояния. */
  async resyncFromParsed(id: number): Promise<PublishedVideo> {
    const video = await this.findOne(id);

    const { parsedVideo, playerSource, directSource } =
      await this.getParsedVideoForPublish(video.parsed_video_id);

    this.applySnapshot(video, parsedVideo, playerSource, directSource);

    return this.publishedVideosRepository.save(video);
  }

  /** Возвращает инкрементальный фид изменений published-слоя для публичного контура. */
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

  /** Загружает parsed-видео и обязательные источники, необходимые для публикации. */
  private async getParsedVideoForPublish(parsedVideoId: number): Promise<{
    parsedVideo: ParsedVideo;
    playerSource: ParsedVideoSource;
    directSource: ParsedVideoSource | null;
  }> {
    const parsedVideo = await this.parsedVideosRepository.findOne({
      where: { id: parsedVideoId },
      relations: ['sources'],
    });

    if (!parsedVideo) {
      throw new NotFoundException(
        `Parsed video with id ${parsedVideoId} not found`,
      );
    }

    const playerSource =
      parsedVideo.sources?.find(
        (source) =>
          source.type === ParserVideoSourceType.PLAYER && source.url.length > 0,
      ) || null;

    if (!playerSource) {
      throw new BadRequestException(
        `Parsed video ${parsedVideoId} has no player source and cannot be published`,
      );
    }

    const directSource =
      parsedVideo.sources?.find(
        (source) => source.type === ParserVideoSourceType.DIRECT_VIDEO,
      ) || null;

    return {
      parsedVideo,
      playerSource,
      directSource,
    };
  }

  /** Копирует поля parsed-видео в publish-проекцию (snapshot-слой). */
  private applySnapshot(
    target: PublishedVideo,
    parsedVideo: ParsedVideo,
    playerSource: ParsedVideoSource,
    directSource: ParsedVideoSource | null,
  ): void {
    target.parsed_video_id = parsedVideo.id;
    target.site = parsedVideo.site;
    target.page_url = parsedVideo.page_url;
    target.title = parsedVideo.title;
    target.description = parsedVideo.description;
    target.duration_seconds = parsedVideo.duration_seconds;
    target.player_source_url = playerSource.url;
    target.direct_video_url = directSource?.url || null;
    target.direct_video_expires_at =
      directSource?.expires_at || parsedVideo.direct_video_expires_at || null;
    target.thumbnail_url = parsedVideo.thumbnail_url;
    target.poster_url = parsedVideo.poster_url;
    target.trailer_mp4_url = parsedVideo.trailer_mp4_url;
    target.trailer_webm_url = parsedVideo.trailer_webm_url;
    target.timeline_sprite_template_url =
      parsedVideo.timeline_sprite_template_url;
  }

  /** Применяет редактируемые значения формы публикации поверх snapshot-данных. */
  private applyCreateOverrides(
    target: PublishedVideo,
    dto: CreatePublishedVideoDto,
  ): void {
    if (dto.title !== undefined) {
      target.title = dto.title;
    }
    if (dto.description !== undefined) {
      target.description = dto.description;
    }
  }

  /** Обновляет статус parsed-video при изменении жизненного цикла публикации. */
  private async setParsedVideoStatus(
    parsedVideoId: number,
    status: ParsedVideoStatus,
  ): Promise<void> {
    await this.parsedVideosRepository.update({ id: parsedVideoId }, { status });
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
