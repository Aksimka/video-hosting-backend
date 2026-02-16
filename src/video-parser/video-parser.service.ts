import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull, In } from 'typeorm';
import { IVideoParserStrategy } from './interfaces/video-parser-strategy.interface';
import { ParsedVideo } from './entities/parsed-video.entity';
import { ParsedVideoSource } from './entities/parsed-video-source.entity';
import { ParserTag } from './entities/parser-tag.entity';
import { ParserVideoTag } from './entities/parser-video-tag.entity';
import { RawTagMapping } from 'src/tag-governance/entities/raw-tag-mapping.entity';
import { RawTagMappingStatus } from 'src/tag-governance/enums/raw-tag-mapping-status.enum';
import { RawModel } from 'src/tag-governance/entities/raw-model.entity';
import { VideoRawModel } from 'src/tag-governance/entities/video-raw-model.entity';
import { RawModelMapping } from 'src/tag-governance/entities/raw-model-mapping.entity';
import { ParserVideoSourceType } from './enums/parser-video-source-type.enum';
import { ParserSourceStatus } from './enums/parser-source-status.enum';
import { ParserTagType } from './enums/parser-tag-type.enum';
import {
  ParsedModelData,
  ParsedTagData,
  ParsedVideoCategoryItem,
  ParsedVideoData,
} from './interfaces/parsed-video-data.interface';
import { SexStudentkiVideoParserStrategy } from './strategies/sex-studentki-video-parser.strategy';
import { ParserVideoSite } from './enums/parser-video-site.enum';
import { ParsedVideoStatus } from './enums/parsed-video-status.enum';
import { ParsedVideosPublicationState } from './enums/parsed-videos-publication-state.enum';

@Injectable()
export class VideoParserService {
  private readonly logger = new Logger(VideoParserService.name);
  private readonly strategies: IVideoParserStrategy[];
  private readonly refreshInFlight = new Map<number, Promise<ParsedVideo>>();

  constructor(
    @InjectRepository(ParsedVideo)
    private readonly parsedVideoRepository: Repository<ParsedVideo>,
    @InjectRepository(ParsedVideoSource)
    private readonly parsedVideoSourceRepository: Repository<ParsedVideoSource>,
    @InjectRepository(ParserTag, 'tags')
    private readonly parserTagRepository: Repository<ParserTag>,
    @InjectRepository(ParserVideoTag, 'tags')
    private readonly parserVideoTagRepository: Repository<ParserVideoTag>,
    @InjectRepository(RawTagMapping, 'tags')
    private readonly rawTagMappingRepository: Repository<RawTagMapping>,
    @InjectRepository(RawModel, 'tags')
    private readonly rawModelRepository: Repository<RawModel>,
    @InjectRepository(VideoRawModel, 'tags')
    private readonly videoRawModelRepository: Repository<VideoRawModel>,
    @InjectRepository(RawModelMapping, 'tags')
    private readonly rawModelMappingRepository: Repository<RawModelMapping>,
    private readonly sexStudentkiStrategy: SexStudentkiVideoParserStrategy,
  ) {
    this.strategies = [sexStudentkiStrategy];
  }

  /** Парсит страницу категории, дедуплицирует ссылки и опционально гидрирует каждое видео. */
  async parseCategory(
    categoryUrl: string,
    pages = 1,
    hydrateVideos = false,
  ): Promise<{
    site: ParserVideoSite;
    categoryUrl: string;
    pages: number;
    itemsFound: number;
    itemsPersisted: number;
    itemsHydrated: number;
    itemsFailed: number;
    items: ParsedVideoCategoryItem[];
  }> {
    const strategy = this.getStrategyForUrl(categoryUrl);
    const uniqueItemsMap = new Map<string, ParsedVideoCategoryItem>();

    for (let page = 1; page <= pages; page += 1) {
      const pageUrl = this.buildCategoryPageUrl(categoryUrl, page);
      const parsed = await strategy.parseCategory(pageUrl);

      for (const item of parsed.items) {
        if (uniqueItemsMap.has(item.pageUrl)) {
          continue;
        }
        uniqueItemsMap.set(item.pageUrl, item);
      }
    }

    const items = Array.from(uniqueItemsMap.values());

    let itemsPersisted = 0;
    let itemsHydrated = 0;
    let itemsFailed = 0;

    if (hydrateVideos) {
      for (const item of items) {
        try {
          await this.parseAndStoreVideo(item.pageUrl, {
            categoryUrl,
            forceRefreshSources: false,
          });
          itemsPersisted += 1;
          itemsHydrated += 1;
        } catch (error) {
          itemsFailed += 1;
          this.logger.error(
            `Failed to hydrate video ${item.pageUrl}: ${String(error)}`,
          );
        }
      }
    }

    return {
      site: this.resolveSiteByStrategy(strategy),
      categoryUrl,
      pages,
      itemsFound: items.length,
      itemsPersisted,
      itemsHydrated,
      itemsFailed,
      items,
    };
  }

  /** Парсит страницу видео, валидирует обязательный player-source и сохраняет результат. */
  async parseAndStoreVideo(
    videoUrl: string,
    options?: {
      categoryUrl?: string;
      forceRefreshSources?: boolean;
    },
  ): Promise<ParsedVideo> {
    const strategy = this.getStrategyForUrl(videoUrl);
    const parsedVideo = await strategy.parseVideo(videoUrl);

    if (!parsedVideo.playerSourceUrl) {
      this.logger.error(`PLAYER source not found for ${videoUrl}`);
      throw new BadRequestException(
        `Player source is required for parsed video: ${videoUrl}`,
      );
    }

    if (options?.categoryUrl) {
      parsedVideo.categoryUrl = options.categoryUrl;
    }

    if (parsedVideo.playerSourceUrl && options?.forceRefreshSources !== false) {
      const resolved = await this.resolveDirectVideoSource(
        parsedVideo.playerSourceUrl,
        parsedVideo.pageUrl,
      );
      parsedVideo.directVideoUrl = resolved.directVideoUrl;
      parsedVideo.directVideoExpiresAt = resolved.expiresAt || undefined;
    }

    return this.persistParsedVideo(parsedVideo);
  }

  /** Возвращает рабочую direct-ссылку; при необходимости обновляет источники on-demand. */
  async getPlayableVideoSource(videoId: number): Promise<{
    videoId: number;
    title: string;
    pageUrl: string;
    directVideoUrl: string;
    expiresAt: Date | null;
    refreshed: boolean;
    sourceStatus: ParserSourceStatus;
  }> {
    const video = await this.findParsedVideoById(videoId);
    const directSource = this.findSource(
      video,
      ParserVideoSourceType.DIRECT_VIDEO,
    );

    const mustRefresh = this.shouldRefreshDirectSource(directSource);
    if (mustRefresh) {
      const refreshedVideo = await this.refreshVideoSources(
        video.id,
        'on-demand',
      );
      const refreshedDirectSource = this.findSource(
        refreshedVideo,
        ParserVideoSourceType.DIRECT_VIDEO,
      );

      if (!refreshedDirectSource?.url) {
        throw new ServiceUnavailableException(
          `Failed to refresh direct source for video ${video.id}`,
        );
      }

      return {
        videoId: refreshedVideo.id,
        title: refreshedVideo.title,
        pageUrl: refreshedVideo.page_url,
        directVideoUrl: refreshedDirectSource.url,
        expiresAt: refreshedDirectSource.expires_at,
        refreshed: true,
        sourceStatus: refreshedDirectSource.status,
      };
    }

    if (!directSource?.url) {
      throw new ServiceUnavailableException(
        `Direct source is unavailable for video ${video.id}`,
      );
    }

    return {
      videoId: video.id,
      title: video.title,
      pageUrl: video.page_url,
      directVideoUrl: directSource.url,
      expiresAt: directSource.expires_at,
      refreshed: false,
      sourceStatus: directSource.status,
    };
  }

  /** Возвращает список parsed-видео с фильтрацией по факту публикации. */
  async findParsedVideos(
    limit = 50,
    offset = 0,
    publicationState: ParsedVideosPublicationState = ParsedVideosPublicationState.UNPUBLISHED,
  ): Promise<ParsedVideo[]> {
    const parsedLimit = Math.max(1, Math.min(limit, 200));
    const parsedOffset = Math.max(0, offset);
    const where =
      publicationState === ParsedVideosPublicationState.ALL
        ? undefined
        : {
            status:
              publicationState === ParsedVideosPublicationState.PUBLISHED
                ? ParsedVideoStatus.PUBLISHED
                : ParsedVideoStatus.PARSED,
          };

    return this.parsedVideoRepository.find({
      where,
      relations: ['sources'],
      order: { updated_at: 'DESC' },
      take: parsedLimit,
      skip: parsedOffset,
    });
  }

  /** Возвращает parsed-видео вместе с привязанными raw-тегами и raw-моделями. */
  async getParsedVideoWithTags(videoId: number): Promise<{
    video: ParsedVideo;
    tags: ParserTag[];
    models: RawModel[];
  }> {
    const video = await this.findParsedVideoById(videoId);
    const tags = await this.getTagsForParsedVideo(video);
    const models = await this.getModelsForParsedVideo(video);
    return { video, tags, models };
  }

  /** Запускает refresh источников для видео с защитой от параллельных дублей. */
  async refreshVideoSources(
    videoId: number,
    reason = 'manual',
  ): Promise<ParsedVideo> {
    const existingPromise = this.refreshInFlight.get(videoId);
    if (existingPromise) {
      return existingPromise;
    }

    const refreshPromise = this.refreshVideoSourcesInternal(videoId, reason)
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to refresh sources for video ${videoId}: ${String(error)}`,
        );
        throw error;
      })
      .finally(() => {
        this.refreshInFlight.delete(videoId);
      });

    this.refreshInFlight.set(videoId, refreshPromise);

    return refreshPromise;
  }

  /** Батчево обновляет direct-ссылки, которые уже истекли или скоро истекут. */
  async refreshExpiringSourcesBatch(
    limit = this.getRefreshBatchSize(),
  ): Promise<{
    checked: number;
    refreshed: number;
    failed: number;
  }> {
    const now = new Date();
    const refreshBoundary = new Date(
      now.getTime() + this.getDirectRefreshThresholdMs(),
    );

    const staleDirectSources = await this.parsedVideoSourceRepository.find({
      where: [
        {
          type: ParserVideoSourceType.DIRECT_VIDEO,
          expires_at: IsNull(),
        },
        {
          type: ParserVideoSourceType.DIRECT_VIDEO,
          expires_at: LessThanOrEqual(refreshBoundary),
        },
      ],
      relations: ['parsed_video'],
      take: limit,
      order: {
        last_checked_at: 'ASC',
      },
    });

    let refreshed = 0;
    let failed = 0;

    for (const source of staleDirectSources) {
      try {
        await this.refreshVideoSources(source.parsed_video_id, 'scheduled');
        refreshed += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      checked: staleDirectSources.length,
      refreshed,
      failed,
    };
  }

  /** Внутренний refresh pipeline: ищет/обновляет player-source и пересчитывает direct-source. */
  private async refreshVideoSourcesInternal(
    videoId: number,
    reason: string,
  ): Promise<ParsedVideo> {
    const video = await this.findParsedVideoById(videoId);
    const strategy = this.getStrategyForUrl(video.page_url);

    let playerSource = this.findSource(
      video,
      ParserVideoSourceType.PLAYER,
    )?.url;

    if (!playerSource) {
      const parsedVideo = await strategy.parseVideo(video.page_url);
      playerSource = parsedVideo.playerSourceUrl;
      await this.persistParsedVideo(parsedVideo, video);
    }

    if (!playerSource) {
      throw new ServiceUnavailableException(
        `Player source not found for video ${video.id}`,
      );
    }

    const resolved = await this.resolveDirectVideoSource(
      playerSource,
      video.page_url,
    );

    await this.upsertSource(video.id, {
      type: ParserVideoSourceType.DIRECT_VIDEO,
      url: resolved.directVideoUrl,
      status: this.getSourceStatusByExpiresAt(resolved.expiresAt),
      expiresAt: resolved.expiresAt,
      lastError: null,
    });

    video.direct_video_expires_at = resolved.expiresAt;
    video.last_checked_at = new Date();
    video.last_refreshed_at = new Date();
    video.needs_refresh = false;
    await this.parsedVideoRepository.save(video);

    this.logger.log(
      `Refreshed direct source for video ${video.id}. Reason: ${reason}`,
    );

    return this.findParsedVideoById(video.id);
  }

  /** Разрешает player-ссылку в прямой URL видео и вычисляет срок ее действия. */
  private async resolveDirectVideoSource(
    playerSourceUrl: string,
    pageUrl: string,
  ): Promise<{ directVideoUrl: string; expiresAt: Date | null }> {
    const response = await fetch(playerSourceUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Referer: pageUrl,
        Accept: '*/*',
      },
    });

    let directVideoUrl: string | null = null;

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        directVideoUrl = new URL(location, playerSourceUrl).toString();
      }
    }

    if (!directVideoUrl && response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.startsWith('video/')) {
        directVideoUrl = playerSourceUrl;
      }
    }

    if (!directVideoUrl) {
      throw new ServiceUnavailableException(
        `Unable to resolve direct source from player URL: ${playerSourceUrl}`,
      );
    }

    return {
      directVideoUrl,
      expiresAt: this.extractExpiresAtFromUrl(directVideoUrl),
    };
  }

  /** Извлекает timestamp истечения из query-параметра `expires` direct URL. */
  private extractExpiresAtFromUrl(url: string): Date | null {
    try {
      const parsed = new URL(url);
      const expires = parsed.searchParams.get('expires');
      if (!expires) {
        return null;
      }

      const timestamp = parseInt(expires, 10);
      if (Number.isNaN(timestamp)) {
        return null;
      }

      if (timestamp > 10_000_000_000) {
        return new Date(timestamp);
      }

      return new Date(timestamp * 1000);
    } catch {
      return null;
    }
  }

  /** Определяет, нужен ли refresh direct-source прямо сейчас. */
  private shouldRefreshDirectSource(source?: ParsedVideoSource): boolean {
    if (!source || !source.url) {
      return true;
    }

    if (!source.expires_at) {
      return true;
    }

    const thresholdTime = Date.now() + this.getDirectRefreshThresholdMs();
    return source.expires_at.getTime() <= thresholdTime;
  }

  /** Вычисляет статус источника по дате истечения. */
  private getSourceStatusByExpiresAt(
    expiresAt: Date | null,
  ): ParserSourceStatus {
    if (!expiresAt) {
      return ParserSourceStatus.STALE;
    }

    return expiresAt.getTime() > Date.now()
      ? ParserSourceStatus.ACTIVE
      : ParserSourceStatus.EXPIRED;
  }

  /** Возвращает порог упреждающего refresh в миллисекундах. */
  private getDirectRefreshThresholdMs(): number {
    const raw = parseInt(
      process.env.PARSER_DIRECT_REFRESH_THRESHOLD_SECONDS || '900',
      10,
    );
    return Number.isNaN(raw) ? 900_000 : raw * 1000;
  }

  /** Возвращает размер пачки для планового refresh процесса. */
  private getRefreshBatchSize(): number {
    const raw = parseInt(process.env.PARSER_REFRESH_BATCH_SIZE || '20', 10);
    return Number.isNaN(raw) ? 20 : Math.max(1, Math.min(200, raw));
  }

  /** Upsert для parsed_videos и всех связанных источников/сущностей parser-слоя. */
  private async persistParsedVideo(
    parsedVideo: ParsedVideoData,
    existingVideo?: ParsedVideo,
  ): Promise<ParsedVideo> {
    if (!parsedVideo.playerSourceUrl) {
      throw new BadRequestException(
        `Player source is required for parsed video: ${parsedVideo.pageUrl}`,
      );
    }

    const foundVideo =
      existingVideo ||
      (await this.parsedVideoRepository.findOne({
        where: {
          site: parsedVideo.site,
          page_url: parsedVideo.pageUrl,
        },
      }));

    const video =
      foundVideo ||
      this.parsedVideoRepository.create({
        site: parsedVideo.site,
        page_url: parsedVideo.pageUrl,
      });

    video.site = parsedVideo.site;
    video.page_url = parsedVideo.pageUrl;
    video.category_url = parsedVideo.categoryUrl || video.category_url || null;
    video.page_slug_id = parsedVideo.pageSlugId || null;
    video.media_id = parsedVideo.mediaId || null;
    video.title = parsedVideo.title;
    video.description = parsedVideo.description || null;
    video.duration_seconds = parsedVideo.durationSeconds ?? null;
    video.thumbnail_url = parsedVideo.thumbnailUrl || null;
    video.poster_url = parsedVideo.posterUrl || null;
    video.trailer_mp4_url = parsedVideo.trailerMp4Url || null;
    video.trailer_webm_url = parsedVideo.trailerWebmUrl || null;
    video.timeline_sprite_template_url =
      parsedVideo.timelineSpriteTemplateUrl || null;
    video.direct_video_expires_at = parsedVideo.directVideoExpiresAt || null;
    video.last_checked_at = new Date();
    video.needs_refresh = !parsedVideo.directVideoUrl;
    if (!video.status) {
      video.status = ParsedVideoStatus.PARSED;
    }

    const savedVideo = await this.parsedVideoRepository.save(video);

    await this.upsertSource(savedVideo.id, {
      type: ParserVideoSourceType.PAGE,
      url: parsedVideo.pageUrl,
      status: ParserSourceStatus.ACTIVE,
      expiresAt: null,
      lastError: null,
    });

    if (parsedVideo.playerSourceUrl) {
      await this.upsertSource(savedVideo.id, {
        type: ParserVideoSourceType.PLAYER,
        url: parsedVideo.playerSourceUrl,
        status: ParserSourceStatus.ACTIVE,
        expiresAt: null,
        lastError: null,
      });
    }

    if (parsedVideo.directVideoUrl) {
      await this.upsertSource(savedVideo.id, {
        type: ParserVideoSourceType.DIRECT_VIDEO,
        url: parsedVideo.directVideoUrl,
        status: this.getSourceStatusByExpiresAt(
          parsedVideo.directVideoExpiresAt || null,
        ),
        expiresAt: parsedVideo.directVideoExpiresAt || null,
        lastError: null,
      });
    }

    if (parsedVideo.thumbnailUrl) {
      await this.upsertSource(savedVideo.id, {
        type: ParserVideoSourceType.THUMBNAIL,
        url: parsedVideo.thumbnailUrl,
        status: ParserSourceStatus.ACTIVE,
        expiresAt: null,
        lastError: null,
      });
    }

    if (parsedVideo.posterUrl) {
      await this.upsertSource(savedVideo.id, {
        type: ParserVideoSourceType.POSTER,
        url: parsedVideo.posterUrl,
        status: ParserSourceStatus.ACTIVE,
        expiresAt: null,
        lastError: null,
      });
    }

    if (parsedVideo.trailerMp4Url) {
      await this.upsertSource(savedVideo.id, {
        type: ParserVideoSourceType.TRAILER_MP4,
        url: parsedVideo.trailerMp4Url,
        status: ParserSourceStatus.ACTIVE,
        expiresAt: null,
        lastError: null,
      });
    }

    if (parsedVideo.trailerWebmUrl) {
      await this.upsertSource(savedVideo.id, {
        type: ParserVideoSourceType.TRAILER_WEBM,
        url: parsedVideo.trailerWebmUrl,
        status: ParserSourceStatus.ACTIVE,
        expiresAt: null,
        lastError: null,
      });
    }

    if (parsedVideo.timelineSpriteTemplateUrl) {
      await this.upsertSource(savedVideo.id, {
        type: ParserVideoSourceType.TIMELINE_SPRITE_TEMPLATE,
        url: parsedVideo.timelineSpriteTemplateUrl,
        status: ParserSourceStatus.ACTIVE,
        expiresAt: null,
        lastError: null,
      });
    }

    await this.syncVideoTags(savedVideo, parsedVideo.tags || []);
    await this.syncVideoModels(savedVideo, parsedVideo.models || []);

    return this.findParsedVideoById(savedVideo.id);
  }

  /** Синхронизирует raw-теги видео и поддерживает mapping-записи для governance. */
  private async syncVideoTags(
    video: ParsedVideo,
    tags: ParsedTagData[],
  ): Promise<void> {
    const uniqueTagsMap = new Map<string, ParsedTagData>();
    for (const tag of tags) {
      if (!tag.name || !tag.slug) {
        continue;
      }
      const key = `${tag.type}:${tag.slug}`;
      if (!uniqueTagsMap.has(key)) {
        uniqueTagsMap.set(key, tag);
      }
    }

    const normalizedTags = Array.from(uniqueTagsMap.values());

    const externalKey = this.buildExternalVideoKey(video.site, video.page_url);

    await this.parserVideoTagRepository.delete({
      site: video.site,
      video_external_key: externalKey,
    });

    if (normalizedTags.length === 0) {
      return;
    }

    const tagIds: number[] = [];

    for (const tag of normalizedTags) {
      const existingTag = await this.parserTagRepository.findOne({
        where: {
          site: video.site,
          slug: tag.slug,
          type: tag.type,
        },
      });

      if (existingTag) {
        if (
          existingTag.name !== tag.name ||
          existingTag.group_label !== (tag.groupLabel || null)
        ) {
          existingTag.name = tag.name;
          existingTag.group_label = tag.groupLabel || null;
          await this.parserTagRepository.save(existingTag);
        }
        tagIds.push(existingTag.id);
        continue;
      }

      const createdTag = this.parserTagRepository.create({
        site: video.site,
        slug: tag.slug,
        name: tag.name,
        type: tag.type || ParserTagType.TAG,
        group_label: tag.groupLabel || null,
      });

      const savedTag = await this.parserTagRepository.save(createdTag);
      tagIds.push(savedTag.id);
    }

    if (tagIds.length === 0) {
      return;
    }

    const links = tagIds.map((tagId) =>
      this.parserVideoTagRepository.create({
        site: video.site,
        video_external_key: externalKey,
        tag_id: tagId,
      }),
    );

    await this.parserVideoTagRepository.save(links);
    await this.ensureRawTagMappings(tagIds);
  }

  /** Синхронизирует raw-модели видео и поддерживает mapping-записи для governance. */
  private async syncVideoModels(
    video: ParsedVideo,
    models: ParsedModelData[],
  ): Promise<void> {
    const uniqueModelsMap = new Map<string, ParsedModelData>();
    for (const model of models) {
      if (!model.name || !model.slug) {
        continue;
      }
      if (!uniqueModelsMap.has(model.slug)) {
        uniqueModelsMap.set(model.slug, model);
      }
    }

    const normalizedModels = Array.from(uniqueModelsMap.values());
    const externalKey = this.buildExternalVideoKey(video.site, video.page_url);

    await this.videoRawModelRepository.delete({
      site: video.site,
      video_external_key: externalKey,
    });

    if (normalizedModels.length === 0) {
      return;
    }

    const rawModelIds: number[] = [];

    for (const model of normalizedModels) {
      const existingRawModel = await this.rawModelRepository.findOne({
        where: {
          site: video.site,
          slug: model.slug,
        },
      });

      if (existingRawModel) {
        if (existingRawModel.name !== model.name) {
          existingRawModel.name = model.name;
          existingRawModel.normalized_name = this.normalizeModelName(
            model.name,
          );
          await this.rawModelRepository.save(existingRawModel);
        }
        rawModelIds.push(existingRawModel.id);
        continue;
      }

      const createdRawModel = this.rawModelRepository.create({
        site: video.site,
        slug: model.slug,
        name: model.name,
        normalized_name: this.normalizeModelName(model.name),
      });

      const savedRawModel = await this.rawModelRepository.save(createdRawModel);
      rawModelIds.push(savedRawModel.id);
    }

    if (rawModelIds.length === 0) {
      return;
    }

    const links = rawModelIds.map((rawModelId) =>
      this.videoRawModelRepository.create({
        site: video.site,
        video_external_key: externalKey,
        raw_model_id: rawModelId,
      }),
    );

    await this.videoRawModelRepository.save(links);
    await this.ensureRawModelMappings(rawModelIds);
  }

  /** Гарантирует наличие mapping-записей для raw-тегов (status=UNMAPPED по умолчанию). */
  private async ensureRawTagMappings(rawTagIds: number[]): Promise<void> {
    const uniqueTagIds = Array.from(new Set(rawTagIds)).filter((id) => id > 0);
    if (uniqueTagIds.length === 0) {
      return;
    }

    const existing = await this.rawTagMappingRepository.find({
      where: {
        raw_tag_id: In(uniqueTagIds),
      },
      select: ['raw_tag_id'],
    });

    const existingIds = new Set(existing.map((item) => item.raw_tag_id));
    const toCreate = uniqueTagIds.filter((id) => !existingIds.has(id));

    if (toCreate.length === 0) {
      return;
    }

    await this.rawTagMappingRepository.save(
      toCreate.map((rawTagId) =>
        this.rawTagMappingRepository.create({
          raw_tag_id: rawTagId,
          status: RawTagMappingStatus.UNMAPPED,
          canonical_tag_id: null,
        }),
      ),
    );
  }

  /** Гарантирует наличие mapping-записей для raw-моделей (status=UNMAPPED по умолчанию). */
  private async ensureRawModelMappings(rawModelIds: number[]): Promise<void> {
    const uniqueModelIds = Array.from(new Set(rawModelIds)).filter(
      (id) => id > 0,
    );
    if (uniqueModelIds.length === 0) {
      return;
    }

    const existing = await this.rawModelMappingRepository.find({
      where: {
        raw_model_id: In(uniqueModelIds),
      },
      select: ['raw_model_id'],
    });

    const existingIds = new Set(existing.map((item) => item.raw_model_id));
    const toCreate = uniqueModelIds.filter((id) => !existingIds.has(id));

    if (toCreate.length === 0) {
      return;
    }

    await this.rawModelMappingRepository.save(
      toCreate.map((rawModelId) =>
        this.rawModelMappingRepository.create({
          raw_model_id: rawModelId,
          status: RawTagMappingStatus.UNMAPPED,
          canonical_model_id: null,
        }),
      ),
    );
  }

  /** Строит стабильный внешний ключ видео в рамках parser/governance связок. */
  private buildExternalVideoKey(
    site: ParserVideoSite,
    pageUrl: string,
  ): string {
    return `${site}|${pageUrl}`;
  }

  /** Возвращает raw-теги, связанные с parsed-видео по внешнему ключу. */
  private async getTagsForParsedVideo(
    video: ParsedVideo,
  ): Promise<ParserTag[]> {
    const externalKey = this.buildExternalVideoKey(video.site, video.page_url);
    const links = await this.parserVideoTagRepository.find({
      where: {
        site: video.site,
        video_external_key: externalKey,
      },
    });

    if (links.length === 0) {
      return [];
    }

    const tagIds = links.map((link) => link.tag_id);
    return this.parserTagRepository.findBy({
      id: In(tagIds),
    });
  }

  /** Возвращает raw-модели, связанные с parsed-видео по внешнему ключу. */
  private async getModelsForParsedVideo(
    video: ParsedVideo,
  ): Promise<RawModel[]> {
    const externalKey = this.buildExternalVideoKey(video.site, video.page_url);
    const links = await this.videoRawModelRepository.find({
      where: {
        site: video.site,
        video_external_key: externalKey,
      },
    });

    if (links.length === 0) {
      return [];
    }

    const rawModelIds = links.map((link) => link.raw_model_id);
    return this.rawModelRepository.findBy({
      id: In(rawModelIds),
    });
  }

  /** Нормализует имя модели для дедупликации и поиска совпадений. */
  private normalizeModelName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** Upsert конкретного источника parsed-видео по типу (`PAGE`, `PLAYER`, `DIRECT_VIDEO`, ...). */
  private async upsertSource(
    parsedVideoId: number,
    data: {
      type: ParserVideoSourceType;
      url: string;
      status: ParserSourceStatus;
      expiresAt: Date | null;
      lastError: string | null;
    },
  ): Promise<ParsedVideoSource> {
    const existing = await this.parsedVideoSourceRepository.findOne({
      where: {
        parsed_video_id: parsedVideoId,
        type: data.type,
      },
    });

    const source =
      existing ||
      this.parsedVideoSourceRepository.create({
        parsed_video_id: parsedVideoId,
        type: data.type,
      });

    source.url = data.url;
    source.status = data.status;
    source.expires_at = data.expiresAt;
    source.last_error = data.lastError;
    source.last_checked_at = new Date();

    return this.parsedVideoSourceRepository.save(source);
  }

  /** Ищет источник указанного типа в уже загруженных relations parsed-видео. */
  private findSource(
    video: ParsedVideo,
    type: ParserVideoSourceType,
  ): ParsedVideoSource | undefined {
    return video.sources?.find((source) => source.type === type);
  }

  /** Загружает parsed-видео с sources и бросает 404 при отсутствии записи. */
  private async findParsedVideoById(videoId: number): Promise<ParsedVideo> {
    const video = await this.parsedVideoRepository.findOne({
      where: { id: videoId },
      relations: ['sources'],
    });

    if (!video) {
      throw new NotFoundException(`Parsed video with id ${videoId} not found`);
    }

    return video;
  }

  /** Подбирает стратегию парсинга по URL источника. */
  private getStrategyForUrl(url: string): IVideoParserStrategy {
    const strategy = this.strategies.find((item) => item.canHandleUrl(url));
    if (!strategy) {
      throw new BadRequestException(`Unsupported URL for parser: ${url}`);
    }

    return strategy;
  }

  /** Возвращает enum сайта для выбранной стратегии парсинга. */
  private resolveSiteByStrategy(
    strategy: IVideoParserStrategy,
  ): ParserVideoSite {
    if (strategy === this.sexStudentkiStrategy) {
      return ParserVideoSite.SEX_STUDENTKI;
    }

    throw new BadRequestException('Unable to resolve site for parser strategy');
  }

  /** Строит URL страницы категории с учетом пагинации. */
  private buildCategoryPageUrl(baseUrl: string, page: number): string {
    if (page <= 1) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    url.searchParams.set('page', String(page));
    return url.toString();
  }
}
