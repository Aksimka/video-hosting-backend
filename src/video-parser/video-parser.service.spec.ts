import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  createRepositoryMock,
  MockRepository,
} from '../test-utils/create-repository-mock';
import { VideoParserService } from './video-parser.service';
import { ParsedVideo } from './entities/parsed-video.entity';
import { ParsedVideoSource } from './entities/parsed-video-source.entity';
import { ParserTag } from './entities/parser-tag.entity';
import { ParserVideoTag } from './entities/parser-video-tag.entity';
import { RawTagMapping } from 'src/tag-governance/entities/raw-tag-mapping.entity';
import { RawModel } from 'src/tag-governance/entities/raw-model.entity';
import { VideoRawModel } from 'src/tag-governance/entities/video-raw-model.entity';
import { RawModelMapping } from 'src/tag-governance/entities/raw-model-mapping.entity';
import { ParserVideoSite } from './enums/parser-video-site.enum';
import { ParserSourceStatus } from './enums/parser-source-status.enum';
import { ParserVideoSourceType } from './enums/parser-video-source-type.enum';
import { ParsedVideoStatus } from './enums/parsed-video-status.enum';
import { ParsedVideosPublicationState } from './enums/parsed-videos-publication-state.enum';
import { ParsedVideoData } from './interfaces/parsed-video-data.interface';
import { SexStudentkiVideoParserStrategy } from './strategies/sex-studentki-video-parser.strategy';
import { ParserTagType } from './enums/parser-tag-type.enum';

describe('VideoParserService', () => {
  let service: VideoParserService;
  let parsedVideoRepository: MockRepository<ParsedVideo>;
  let parsedVideoSourceRepository: MockRepository<ParsedVideoSource>;
  let parserTagRepository: MockRepository<ParserTag>;
  let parserVideoTagRepository: MockRepository<ParserVideoTag>;
  let rawTagMappingRepository: MockRepository<RawTagMapping>;
  let rawModelRepository: MockRepository<RawModel>;
  let videoRawModelRepository: MockRepository<VideoRawModel>;
  let rawModelMappingRepository: MockRepository<RawModelMapping>;
  let strategy: jest.Mocked<SexStudentkiVideoParserStrategy>;

  const makeParsedVideo = (
    overrides: Partial<ParsedVideo> = {},
    sources: ParsedVideoSource[] = [],
  ): ParsedVideo =>
    ({
      id: 10,
      site: ParserVideoSite.SEX_STUDENTKI,
      page_url: 'https://example.com/video/10',
      title: 'Parsed video',
      description: 'Description',
      duration_seconds: 200,
      status: ParsedVideoStatus.PARSED,
      sources,
      ...overrides,
    }) as ParsedVideo;

  const makeParsedVideoData = (
    overrides: Partial<ParsedVideoData> = {},
  ): ParsedVideoData => ({
    site: ParserVideoSite.SEX_STUDENTKI,
    pageUrl: 'https://example.com/video/10',
    title: 'Parsed video',
    description: 'Description',
    durationSeconds: 200,
    playerSourceUrl: 'https://example.com/player.m3u8',
    tags: [
      {
        name: 'Tag',
        slug: 'tag',
        type: ParserTagType.TAG,
      },
    ],
    models: [],
    ...overrides,
  });

  beforeEach(() => {
    parsedVideoRepository = createRepositoryMock<ParsedVideo>();
    parsedVideoSourceRepository = createRepositoryMock<ParsedVideoSource>();
    parserTagRepository = createRepositoryMock<ParserTag>();
    parserVideoTagRepository = createRepositoryMock<ParserVideoTag>();
    rawTagMappingRepository = createRepositoryMock<RawTagMapping>();
    rawModelRepository = createRepositoryMock<RawModel>();
    videoRawModelRepository = createRepositoryMock<VideoRawModel>();
    rawModelMappingRepository = createRepositoryMock<RawModelMapping>();

    strategy = {
      canHandleUrl: jest.fn(),
      parseCategory: jest.fn(),
      parseVideo: jest.fn(),
    } as unknown as jest.Mocked<SexStudentkiVideoParserStrategy>;
    strategy.canHandleUrl.mockReturnValue(true);

    service = new VideoParserService(
      parsedVideoRepository as Repository<ParsedVideo>,
      parsedVideoSourceRepository as Repository<ParsedVideoSource>,
      parserTagRepository as Repository<ParserTag>,
      parserVideoTagRepository as Repository<ParserVideoTag>,
      rawTagMappingRepository as Repository<RawTagMapping>,
      rawModelRepository as Repository<RawModel>,
      videoRawModelRepository as Repository<VideoRawModel>,
      rawModelMappingRepository as Repository<RawModelMapping>,
      strategy,
    );
  });

  it('deduplicates category items across pages and tracks hydrate failures', async () => {
    strategy.parseCategory
      .mockResolvedValueOnce({
        site: ParserVideoSite.SEX_STUDENTKI,
        categoryUrl: 'https://example.com/category',
        items: [
          { pageUrl: 'https://example.com/video/1' },
          { pageUrl: 'https://example.com/video/2' },
        ],
      })
      .mockResolvedValueOnce({
        site: ParserVideoSite.SEX_STUDENTKI,
        categoryUrl: 'https://example.com/category?page=2',
        items: [
          { pageUrl: 'https://example.com/video/2' },
          { pageUrl: 'https://example.com/video/3' },
        ],
      });

    jest
      .spyOn(service, 'parseAndStoreVideo')
      .mockResolvedValueOnce(makeParsedVideo({ id: 1 }))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(makeParsedVideo({ id: 3 }));

    const result = await service.parseCategory(
      'https://example.com/category',
      2,
      true,
    );

    expect(result.itemsFound).toBe(3);
    expect(result.itemsHydrated).toBe(2);
    expect(result.itemsPersisted).toBe(2);
    expect(result.itemsFailed).toBe(1);
    expect(result.items.map((item) => item.pageUrl)).toEqual([
      'https://example.com/video/1',
      'https://example.com/video/2',
      'https://example.com/video/3',
    ]);
  });

  it('rejects parsed video without player source', async () => {
    strategy.parseVideo.mockResolvedValue(
      makeParsedVideoData({ playerSourceUrl: undefined }),
    );

    await expect(
      service.parseAndStoreVideo('https://example.com/video/10'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves direct video source before persisting parsed video', async () => {
    const parsed = makeParsedVideoData();
    const persisted = makeParsedVideo({ id: 15 });

    strategy.parseVideo.mockResolvedValue(parsed);
    const resolveDirectVideoSourceSpy = jest
      .spyOn(service as any, 'resolveDirectVideoSource')
      .mockResolvedValue({
        directVideoUrl: 'https://example.com/direct.mp4?expires=1700000000',
        expiresAt: new Date('2026-02-16T14:00:00.000Z'),
      });
    const persistParsedVideoSpy = jest
      .spyOn(service as any, 'persistParsedVideo')
      .mockResolvedValue(persisted);

    const result = await service.parseAndStoreVideo(
      'https://example.com/video/10',
    );

    expect(resolveDirectVideoSourceSpy).toHaveBeenCalledWith(
      'https://example.com/player.m3u8',
      'https://example.com/video/10',
    );
    expect(persistParsedVideoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        directVideoUrl: 'https://example.com/direct.mp4?expires=1700000000',
      }),
    );
    expect(result).toBe(persisted);
  });

  it('refreshes stale playable source on demand', async () => {
    const staleVideo = makeParsedVideo({}, [
      {
        type: ParserVideoSourceType.DIRECT_VIDEO,
        url: 'https://example.com/stale.mp4',
        status: ParserSourceStatus.STALE,
        expires_at: null,
      } as ParsedVideoSource,
    ]);
    const refreshedVideo = makeParsedVideo({ id: staleVideo.id }, [
      {
        type: ParserVideoSourceType.DIRECT_VIDEO,
        url: 'https://example.com/fresh.mp4',
        status: ParserSourceStatus.ACTIVE,
        expires_at: new Date('2026-02-16T15:00:00.000Z'),
      } as ParsedVideoSource,
    ]);

    jest
      .spyOn(service as any, 'findParsedVideoById')
      .mockResolvedValue(staleVideo);
    const refreshVideoSourcesSpy = jest
      .spyOn(service, 'refreshVideoSources')
      .mockResolvedValue(refreshedVideo);

    const result = await service.getPlayableVideoSource(staleVideo.id);

    expect(refreshVideoSourcesSpy).toHaveBeenCalledWith(
      staleVideo.id,
      'on-demand',
    );
    expect(result).toEqual(
      expect.objectContaining({
        videoId: staleVideo.id,
        directVideoUrl: 'https://example.com/fresh.mp4',
        refreshed: true,
        sourceStatus: ParserSourceStatus.ACTIVE,
      }),
    );
  });

  it('throws when refreshed source is still unavailable', async () => {
    const staleVideo = makeParsedVideo({}, []);
    const refreshedVideo = makeParsedVideo({ id: staleVideo.id }, []);

    jest
      .spyOn(service as any, 'findParsedVideoById')
      .mockResolvedValue(staleVideo);
    jest
      .spyOn(service, 'refreshVideoSources')
      .mockResolvedValue(refreshedVideo);

    await expect(
      service.getPlayableVideoSource(staleVideo.id),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('filters parsed videos by publication state and clamps pagination', async () => {
    (parsedVideoRepository.find as jest.Mock).mockResolvedValue([]);

    await service.findParsedVideos(
      500,
      -10,
      ParsedVideosPublicationState.PUBLISHED,
    );

    expect(parsedVideoRepository.find).toHaveBeenCalledWith({
      where: { status: ParsedVideoStatus.PUBLISHED },
      relations: ['sources'],
      order: { updated_at: 'DESC' },
      take: 200,
      skip: 0,
    });
  });
});
