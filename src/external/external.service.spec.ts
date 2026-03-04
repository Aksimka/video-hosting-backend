import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  createRepositoryMock,
  MockRepository,
} from '../test-utils/create-repository-mock';
import { ExternalService } from './external.service';
import { PublishedVideo } from 'src/published-videos/published-video.entity';
import { Category } from 'src/tag-governance/entities/category.entity';
import { PublishedVideoStatus } from 'src/published-videos/enums/published-video-status.enum';
import { ParserVideoSite } from 'src/video-parser/enums/parser-video-site.enum';

describe('ExternalService', () => {
  let service: ExternalService;
  let publishedVideosRepository: MockRepository<PublishedVideo>;
  let categoryRepository: MockRepository<Category>;

  beforeEach(() => {
    publishedVideosRepository = createRepositoryMock<PublishedVideo>();
    categoryRepository = createRepositoryMock<Category>();

    service = new ExternalService(
      publishedVideosRepository as Repository<PublishedVideo>,
      categoryRepository as Repository<Category>,
    );
  });

  it('returns public feed items with upsert and delete operations', async () => {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 1,
          status: PublishedVideoStatus.PUBLISHED,
          updated_at: new Date('2026-02-16T12:00:00.000Z'),
          title: 'Published video',
          description: 'Desc',
          duration_seconds: 100,
          player_source_url: 'https://example.com/player.m3u8',
          direct_video_url: 'https://example.com/video.mp4',
          direct_video_expires_at: null,
          thumbnail_url: 'https://example.com/thumb.jpg',
          poster_url: 'https://example.com/poster.jpg',
          trailer_mp4_url: null,
          trailer_webm_url: null,
          timeline_sprite_template_url: null,
          published_at: new Date('2026-02-16T10:00:00.000Z'),
          site: ParserVideoSite.SEX_STUDENTKI,
          page_url: 'https://example.com/video/1',
        },
        {
          id: 2,
          status: PublishedVideoStatus.HIDDEN,
          updated_at: new Date('2026-02-16T12:10:00.000Z'),
        },
      ]),
    };
    (publishedVideosRepository.createQueryBuilder as jest.Mock).mockReturnValue(
      qb,
    );

    const result = await service.getPublicFeed({ limit: 5 });

    expect(publishedVideosRepository.createQueryBuilder).toHaveBeenCalledWith(
      'published_videos',
    );
    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        operation: 'upsert',
        entityId: 1,
        payload: expect.objectContaining({
          id: 1,
          title: 'Published video',
          playerSourceUrl: 'https://example.com/player.m3u8',
        }),
      }),
    );
    expect(result.items[1]).toEqual(
      expect.objectContaining({
        operation: 'delete',
        entityId: 2,
        payload: null,
      }),
    );
    expect(result.nextCursor).toEqual(expect.any(String));
  });

  it('applies cursor filter and exposes hasMore when response exceeds limit', async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        updatedAt: '2026-02-16T12:00:00.000Z',
        id: 5,
      }),
      'utf8',
    ).toString('base64url');
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 6,
          status: PublishedVideoStatus.PUBLISHED,
          updated_at: new Date('2026-02-16T12:01:00.000Z'),
          title: 'Video 6',
          description: null,
          duration_seconds: null,
          player_source_url: 'https://example.com/6.m3u8',
          direct_video_url: null,
          direct_video_expires_at: null,
          thumbnail_url: null,
          poster_url: null,
          trailer_mp4_url: null,
          trailer_webm_url: null,
          timeline_sprite_template_url: null,
          published_at: null,
          site: ParserVideoSite.SEX_STUDENTKI,
          page_url: 'https://example.com/video/6',
        },
        {
          id: 7,
          status: PublishedVideoStatus.PUBLISHED,
          updated_at: new Date('2026-02-16T12:02:00.000Z'),
          title: 'Video 7',
          description: null,
          duration_seconds: null,
          player_source_url: 'https://example.com/7.m3u8',
          direct_video_url: null,
          direct_video_expires_at: null,
          thumbnail_url: null,
          poster_url: null,
          trailer_mp4_url: null,
          trailer_webm_url: null,
          timeline_sprite_template_url: null,
          published_at: null,
          site: ParserVideoSite.SEX_STUDENTKI,
          page_url: 'https://example.com/video/7',
        },
      ]),
    };
    (publishedVideosRepository.createQueryBuilder as jest.Mock).mockReturnValue(
      qb,
    );

    const result = await service.getPublicFeed({ limit: 1, cursor });

    expect(qb.where).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it('throws on invalid public feed cursor', async () => {
    await expect(
      service.getPublicFeed({ cursor: 'not-a-valid-cursor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns only active categories snapshot', async () => {
    const updatedAt = new Date('2026-02-16T13:00:00.000Z');
    (categoryRepository.find as jest.Mock).mockResolvedValue([
      {
        id: 10,
        name: 'Category',
        slug: 'category',
        preview_url: 'https://example.com/category.jpg',
        updated_at: updatedAt,
      },
    ]);

    const result = await service.getActiveCategories();

    expect(categoryRepository.find).toHaveBeenCalledWith({
      where: { is_active: true },
      order: { name: 'ASC', id: 'ASC' },
    });
    expect(result).toEqual([
      {
        id: 10,
        name: 'Category',
        slug: 'category',
        previewUrl: 'https://example.com/category.jpg',
        updatedAt,
      },
    ]);
  });
});
