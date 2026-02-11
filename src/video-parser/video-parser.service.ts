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
import { ParserVideoSourceType } from './enums/parser-video-source-type.enum';
import { ParserSourceStatus } from './enums/parser-source-status.enum';
import { ParserTagType } from './enums/parser-tag-type.enum';
import {
  ParsedTagData,
  ParsedVideoCategoryItem,
  ParsedVideoData,
} from './interfaces/parsed-video-data.interface';
import { SexStudentkiVideoParserStrategy } from './strategies/sex-studentki-video-parser.strategy';
import { ParserVideoSite } from './enums/parser-video-site.enum';

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
    private readonly sexStudentkiStrategy: SexStudentkiVideoParserStrategy,
  ) {
    this.strategies = [sexStudentkiStrategy];
  }

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

  async findParsedVideos(limit = 50, offset = 0): Promise<ParsedVideo[]> {
    return this.parsedVideoRepository.find({
      relations: ['sources'],
      order: { updated_at: 'DESC' },
      take: Math.max(1, Math.min(limit, 200)),
      skip: Math.max(0, offset),
    });
  }

  async getParsedVideoWithTags(videoId: number): Promise<{
    video: ParsedVideo;
    tags: ParserTag[];
  }> {
    const video = await this.findParsedVideoById(videoId);
    const tags = await this.getTagsForParsedVideo(video);
    return { video, tags };
  }

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

  private getDirectRefreshThresholdMs(): number {
    const raw = parseInt(
      process.env.PARSER_DIRECT_REFRESH_THRESHOLD_SECONDS || '900',
      10,
    );
    return Number.isNaN(raw) ? 900_000 : raw * 1000;
  }

  private getRefreshBatchSize(): number {
    const raw = parseInt(process.env.PARSER_REFRESH_BATCH_SIZE || '20', 10);
    return Number.isNaN(raw) ? 20 : Math.max(1, Math.min(200, raw));
  }

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

    return this.findParsedVideoById(savedVideo.id);
  }

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
  }

  private buildExternalVideoKey(
    site: ParserVideoSite,
    pageUrl: string,
  ): string {
    return `${site}|${pageUrl}`;
  }

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

  private findSource(
    video: ParsedVideo,
    type: ParserVideoSourceType,
  ): ParsedVideoSource | undefined {
    return video.sources?.find((source) => source.type === type);
  }

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

  private getStrategyForUrl(url: string): IVideoParserStrategy {
    const strategy = this.strategies.find((item) => item.canHandleUrl(url));
    if (!strategy) {
      throw new BadRequestException(`Unsupported URL for parser: ${url}`);
    }

    return strategy;
  }

  private resolveSiteByStrategy(
    strategy: IVideoParserStrategy,
  ): ParserVideoSite {
    if (strategy === this.sexStudentkiStrategy) {
      return ParserVideoSite.SEX_STUDENTKI;
    }

    throw new BadRequestException('Unable to resolve site for parser strategy');
  }

  private buildCategoryPageUrl(baseUrl: string, page: number): string {
    if (page <= 1) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    url.searchParams.set('page', String(page));
    return url.toString();
  }
}
