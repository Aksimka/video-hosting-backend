import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  createRepositoryMock,
  MockRepository,
} from '../test-utils/create-repository-mock';
import { PublishedVideo } from './published-video.entity';
import { PublishedVideosService } from './published-videos.service';
import { PublishedVideoStatus } from './enums/published-video-status.enum';
import { ParsedVideo } from 'src/video-parser/entities/parsed-video.entity';
import { ParsedVideoSource } from 'src/video-parser/entities/parsed-video-source.entity';
import { ParserVideoSite } from 'src/video-parser/enums/parser-video-site.enum';
import { ParserVideoSourceType } from 'src/video-parser/enums/parser-video-source-type.enum';
import { ParsedVideoStatus } from 'src/video-parser/enums/parsed-video-status.enum';
import { TagGovernanceService } from 'src/tag-governance/tag-governance.service';

describe('PublishedVideosService', () => {
  let service: PublishedVideosService;
  let publishedVideosRepository: MockRepository<PublishedVideo>;
  let parsedVideosRepository: MockRepository<ParsedVideo>;
  let tagGovernanceService: jest.Mocked<
    Pick<TagGovernanceService, 'assertParsedVideoReadyForPublish'>
  >;

  const makeSource = (
    type: ParserVideoSourceType,
    url: string,
    expiresAt: Date | null = null,
  ): ParsedVideoSource =>
    ({
      type,
      url,
      expires_at: expiresAt,
    }) as ParsedVideoSource;

  const makeParsedVideo = (
    overrides: Partial<ParsedVideo> = {},
    sources: ParsedVideoSource[] = [],
  ): ParsedVideo =>
    ({
      id: 10,
      site: ParserVideoSite.SEX_STUDENTKI,
      page_url: 'https://example.com/video-10',
      title: 'Parsed title',
      description: 'Parsed description',
      duration_seconds: 321,
      thumbnail_url: 'https://example.com/thumb.jpg',
      poster_url: 'https://example.com/poster.jpg',
      trailer_mp4_url: 'https://example.com/trailer.mp4',
      trailer_webm_url: 'https://example.com/trailer.webm',
      timeline_sprite_template_url: 'https://example.com/sprite-{index}.jpg',
      direct_video_expires_at: new Date('2026-02-16T10:00:00.000Z'),
      status: ParsedVideoStatus.PARSED,
      sources,
      ...overrides,
    }) as ParsedVideo;

  beforeEach(() => {
    publishedVideosRepository = createRepositoryMock<PublishedVideo>();
    parsedVideosRepository = createRepositoryMock<ParsedVideo>();
    tagGovernanceService = {
      assertParsedVideoReadyForPublish: jest.fn(),
    };

    service = new PublishedVideosService(
      publishedVideosRepository as Repository<PublishedVideo>,
      parsedVideosRepository as Repository<ParsedVideo>,
      tagGovernanceService as unknown as TagGovernanceService,
    );
  });

  it('creates published snapshot from parsed video and updates parsed status', async () => {
    const parsedVideo = makeParsedVideo({}, [
      makeSource(
        ParserVideoSourceType.PLAYER,
        'https://example.com/player.m3u8',
      ),
      makeSource(
        ParserVideoSourceType.DIRECT_VIDEO,
        'https://example.com/direct.mp4',
        new Date('2026-02-16T11:00:00.000Z'),
      ),
    ]);
    const createdPublished = {
      parsed_video_id: parsedVideo.id,
    } as PublishedVideo;
    const savedPublished = {
      ...createdPublished,
      id: 99,
      title: 'Manual title',
      description: 'Manual description',
      status: PublishedVideoStatus.PUBLISHED,
    } as PublishedVideo;

    (parsedVideosRepository.findOne as jest.Mock).mockResolvedValue(
      parsedVideo,
    );
    (publishedVideosRepository.findOneBy as jest.Mock).mockResolvedValue(null);
    (publishedVideosRepository.create as jest.Mock).mockReturnValue(
      createdPublished,
    );
    (publishedVideosRepository.save as jest.Mock).mockResolvedValue(
      savedPublished,
    );
    (parsedVideosRepository.update as jest.Mock).mockResolvedValue({
      affected: 1,
    });

    const result = await service.createFromParsed({
      parsedVideoId: parsedVideo.id,
      title: 'Manual title',
      description: 'Manual description',
      publishedBy: 7,
    });

    expect(
      tagGovernanceService.assertParsedVideoReadyForPublish,
    ).toHaveBeenCalledWith(parsedVideo.id);
    expect(publishedVideosRepository.create).toHaveBeenCalledWith({
      parsed_video_id: parsedVideo.id,
    });
    expect(publishedVideosRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        parsed_video_id: parsedVideo.id,
        player_source_url: 'https://example.com/player.m3u8',
        direct_video_url: 'https://example.com/direct.mp4',
        title: 'Manual title',
        description: 'Manual description',
        published_by: 7,
        status: PublishedVideoStatus.PUBLISHED,
      }),
    );
    expect(parsedVideosRepository.update).toHaveBeenCalledWith(
      { id: parsedVideo.id },
      { status: ParsedVideoStatus.PUBLISHED },
    );
    expect(result).toBe(savedPublished);
  });

  it('rejects publish when parsed video has no player source', async () => {
    const parsedVideo = makeParsedVideo({}, [
      makeSource(
        ParserVideoSourceType.DIRECT_VIDEO,
        'https://example.com/direct.mp4',
      ),
    ]);

    (parsedVideosRepository.findOne as jest.Mock).mockResolvedValue(
      parsedVideo,
    );

    await expect(
      service.createFromParsed({ parsedVideoId: parsedVideo.id }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(publishedVideosRepository.save).not.toHaveBeenCalled();
    expect(parsedVideosRepository.update).not.toHaveBeenCalled();
  });

  it('updates parsed status to parsed when video is hidden', async () => {
    const publishedVideo = {
      id: 55,
      parsed_video_id: 10,
      status: PublishedVideoStatus.PUBLISHED,
    } as PublishedVideo;
    const hiddenVideo = {
      ...publishedVideo,
      status: PublishedVideoStatus.HIDDEN,
    } as PublishedVideo;

    (publishedVideosRepository.findOneBy as jest.Mock).mockResolvedValue(
      publishedVideo,
    );
    (publishedVideosRepository.save as jest.Mock).mockResolvedValue(
      hiddenVideo,
    );
    (parsedVideosRepository.update as jest.Mock).mockResolvedValue({
      affected: 1,
    });

    const result = await service.hide(publishedVideo.id);

    expect(publishedVideosRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: publishedVideo.id,
        status: PublishedVideoStatus.HIDDEN,
      }),
    );
    expect(parsedVideosRepository.update).toHaveBeenCalledWith(
      { id: publishedVideo.parsed_video_id },
      { status: ParsedVideoStatus.PARSED },
    );
    expect(result.status).toBe(PublishedVideoStatus.HIDDEN);
  });

  it('revalidates governance and syncs parsed status when status changes back to published', async () => {
    const existingVideo = {
      id: 23,
      parsed_video_id: 10,
      status: PublishedVideoStatus.HIDDEN,
      title: 'Old title',
      description: 'Old description',
      published_at: null,
    } as PublishedVideo;
    const savedVideo = {
      ...existingVideo,
      title: 'New title',
      status: PublishedVideoStatus.PUBLISHED,
      published_at: new Date(),
    } as PublishedVideo;

    (publishedVideosRepository.findOneBy as jest.Mock).mockResolvedValue(
      existingVideo,
    );
    (publishedVideosRepository.save as jest.Mock).mockResolvedValue(savedVideo);
    (parsedVideosRepository.update as jest.Mock).mockResolvedValue({
      affected: 1,
    });

    const result = await service.update(existingVideo.id, {
      title: 'New title',
      status: PublishedVideoStatus.PUBLISHED,
    });

    expect(
      tagGovernanceService.assertParsedVideoReadyForPublish,
    ).toHaveBeenCalledWith(existingVideo.parsed_video_id);
    expect(parsedVideosRepository.update).toHaveBeenCalledWith(
      { id: existingVideo.parsed_video_id },
      { status: ParsedVideoStatus.PUBLISHED },
    );
    expect(result.status).toBe(PublishedVideoStatus.PUBLISHED);
    expect(result.title).toBe('New title');
  });
});
