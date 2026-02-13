import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublishedVideo } from './published-video.entity';
import { ParsedVideo } from 'src/video-parser/entities/parsed-video.entity';
import { CreatePublishedVideoDto } from './dto/create-published-video.dto';
import { UpdatePublishedVideoDto } from './dto/update-published-video.dto';
import { ParsedVideoSource } from 'src/video-parser/entities/parsed-video-source.entity';
import { ParserVideoSourceType } from 'src/video-parser/enums/parser-video-source-type.enum';
import { PublishedVideoStatus } from './enums/published-video-status.enum';
import { TagGovernanceService } from 'src/tag-governance/tag-governance.service';

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
    publishedVideo.status = PublishedVideoStatus.PUBLISHED;
    publishedVideo.published_at = publishedVideo.published_at || new Date();
    if (dto.publishedBy !== undefined) {
      publishedVideo.published_by = dto.publishedBy;
    }

    return this.publishedVideosRepository.save(publishedVideo);
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

    return this.publishedVideosRepository.save(video);
  }

  /** Переводит опубликованное видео в скрытый статус. */
  async hide(id: number): Promise<PublishedVideo> {
    const video = await this.findOne(id);
    video.status = PublishedVideoStatus.HIDDEN;
    return this.publishedVideosRepository.save(video);
  }

  /** Пересобирает snapshot опубликованного видео из текущего parsed состояния. */
  async resyncFromParsed(id: number): Promise<PublishedVideo> {
    const video = await this.findOne(id);

    const { parsedVideo, playerSource, directSource } =
      await this.getParsedVideoForPublish(video.parsed_video_id);

    this.applySnapshot(video, parsedVideo, playerSource, directSource);

    return this.publishedVideosRepository.save(video);
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
}
