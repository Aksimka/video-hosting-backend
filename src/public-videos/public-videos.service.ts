import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublishedVideo } from 'src/published-videos/published-video.entity';
import { PublishedVideoStatus } from 'src/published-videos/enums/published-video-status.enum';
import { ListPublicVideosDto } from './dto/list-public-videos.dto';
// Models in public response are temporarily disabled.
// Keep these imports as a reference for quick rollback:
// import { In } from 'typeorm';
// import { VideoRawModel } from 'src/tag-governance/entities/video-raw-model.entity';
// import { RawModelMapping } from 'src/tag-governance/entities/raw-model-mapping.entity';
// import { CanonicalModel } from 'src/tag-governance/entities/canonical-model.entity';
// import { RawTagMappingStatus } from 'src/tag-governance/enums/raw-tag-mapping-status.enum';

@Injectable()
export class PublicVideosService {
  constructor(
    @InjectRepository(PublishedVideo)
    private readonly publishedVideosRepository: Repository<PublishedVideo>,
    // @InjectRepository(VideoRawModel, 'tags')
    // private readonly videoRawModelRepository: Repository<VideoRawModel>,
    // @InjectRepository(RawModelMapping, 'tags')
    // private readonly rawModelMappingRepository: Repository<RawModelMapping>,
    // @InjectRepository(CanonicalModel, 'tags')
    // private readonly canonicalModelRepository: Repository<CanonicalModel>,
  ) {}

  /** Возвращает публичный пагинированный список только опубликованных видео. */
  async findAll(query: ListPublicVideosDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [videos, total] = await this.publishedVideosRepository.findAndCount({
      where: { status: PublishedVideoStatus.PUBLISHED },
      order: { published_at: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      items: videos.map((video) => this.mapListItem(video)),
      total,
      limit,
      offset,
    };
  }

  /** Возвращает публичную детальную карточку опубликованного видео по id. */
  async findOne(id: number) {
    const video = await this.publishedVideosRepository.findOne({
      where: {
        id,
        status: PublishedVideoStatus.PUBLISHED,
      },
    });

    if (!video) {
      throw new NotFoundException(`Published video with id ${id} not found`);
    }

    return this.mapDetails(video);
  }

  /** Преобразует PublishedVideo в компактный list item для каталога. */
  private mapListItem(video: PublishedVideo) {
    return {
      id: video.id,
      title: video.title,
      durationSeconds: video.duration_seconds,
      thumbnailUrl: video.thumbnail_url,
      posterUrl: video.poster_url,
      publishedAt: video.published_at,
    };
  }

  /** Преобразует PublishedVideo в детальную модель для публичной страницы. */
  private mapDetails(video: PublishedVideo) {
    // const models = await this.getModelsForVideo(video);
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
      // models,
    };
  }

  // /** Возвращает список канонических моделей для конкретного опубликованного видео. */
  // private async getModelsForVideo(video: PublishedVideo): Promise<
  //   Array<{
  //     id: number;
  //     name: string;
  //     slug: string;
  //   }>
  // > {
  //   const externalKey = `${video.site}|${video.page_url}`;
  //   const videoModels = await this.videoRawModelRepository.find({
  //     where: {
  //       site: video.site,
  //       video_external_key: externalKey,
  //     },
  //   });
  //
  //   if (videoModels.length === 0) {
  //     return [];
  //   }
  //
  //   const rawModelIds = videoModels.map((item) => item.raw_model_id);
  //   const mappings = await this.rawModelMappingRepository.find({
  //     where: {
  //       raw_model_id: In(rawModelIds),
  //       status: RawTagMappingStatus.MAPPED,
  //     },
  //   });
  //
  //   if (mappings.length === 0) {
  //     return [];
  //   }
  //
  //   const canonicalModelIds = Array.from(
  //     new Set(
  //       mappings
  //         .map((mapping) => mapping.canonical_model_id)
  //         .filter((id): id is number => id !== null),
  //     ),
  //   );
  //
  //   if (canonicalModelIds.length === 0) {
  //     return [];
  //   }
  //
  //   const canonicalModels = await this.canonicalModelRepository.find({
  //     where: {
  //       id: In(canonicalModelIds),
  //       is_active: true,
  //     },
  //     order: {
  //       name: 'ASC',
  //     },
  //   });
  //
  //   return canonicalModels.map((model) => ({
  //     id: model.id,
  //     name: model.name,
  //     slug: model.slug,
  //   }));
  // }
}
