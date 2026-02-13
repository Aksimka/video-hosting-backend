import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublishedVideo } from 'src/published-videos/published-video.entity';
import { PublishedVideoStatus } from 'src/published-videos/enums/published-video-status.enum';
import { ListPublicVideosDto } from './dto/list-public-videos.dto';

@Injectable()
export class PublicVideosService {
  constructor(
    @InjectRepository(PublishedVideo)
    private readonly publishedVideosRepository: Repository<PublishedVideo>,
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
}
