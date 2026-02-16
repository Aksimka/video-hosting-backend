import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { VideoParserService } from './video-parser.service';
import { ParseCategoryDto } from './dto/parse-category.dto';
import { ParseVideoPageDto } from './dto/parse-video-page.dto';
import { ParsedVideosPublicationState } from './enums/parsed-videos-publication-state.enum';
import { ListParsedVideosDto } from './dto/list-parsed-videos.dto';

@Controller('video-parser')
export class VideoParserController {
  constructor(private readonly videoParserService: VideoParserService) {}

  /**
   * Парсит категорию и сохраняет найденные видео в БД.
   * По желанию может сразу гидрировать каждую страницу видео.
   */
  @Post('categories/parse')
  @HttpCode(HttpStatus.OK)
  async parseCategory(@Body() dto: ParseCategoryDto) {
    return this.videoParserService.parseCategory(
      dto.url,
      dto.pages ?? 1,
      dto.hydrateVideos ?? false,
    );
  }

  /**
   * Парсит одну страницу видео, сохраняет unified-данные, теги и источники.
   */
  @Post('videos/parse')
  @HttpCode(HttpStatus.OK)
  async parseVideo(@Body() dto: ParseVideoPageDto) {
    return this.videoParserService.parseAndStoreVideo(dto.url, {
      categoryUrl: dto.categoryUrl,
      forceRefreshSources: dto.forceRefreshSources ?? true,
    });
  }

  /**
   * Возвращает список успешно распарсенных видео (с источниками).
   */
  @Get('parsed-videos')
  async getParsedVideos(@Query() query: ListParsedVideosDto) {
    return this.videoParserService.findParsedVideos(
      query.limit ?? 50,
      query.offset ?? 0,
      query.publicationState ?? ParsedVideosPublicationState.UNPUBLISHED,
    );
  }

  /**
   * Возвращает детальную карточку распарсенного видео для админки.
   */
  @Get('parsed-videos/:id')
  async getParsedVideoById(@Param('id', ParseIntPipe) id: number) {
    return this.videoParserService.getParsedVideoWithTags(id);
  }

  /**
   * Возвращает рабочую прямую ссылку на видео.
   * Если ссылка протухла/скоро протухнет, обновляет её on-demand.
   */
  @Get('videos/:id/playable')
  async getPlayableVideo(@Param('id', ParseIntPipe) id: number) {
    return this.videoParserService.getPlayableVideoSource(id);
  }

  /**
   * Форсирует обновление источников для конкретного видео.
   */
  @Post('videos/:id/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshVideo(@Param('id', ParseIntPipe) id: number) {
    return this.videoParserService.refreshVideoSources(id, 'manual-endpoint');
  }

  /**
   * Ручной запуск фонового обновления протухающих ссылок.
   */
  @Post('videos/refresh-expiring')
  @HttpCode(HttpStatus.OK)
  async refreshExpiringVideos() {
    return this.videoParserService.refreshExpiringSourcesBatch();
  }
}
