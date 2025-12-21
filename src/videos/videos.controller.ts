import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Param,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { generateResolutionIndexMap } from 'src/video-converter/utils/generateOutputOptions';
import { VideoConverterResolution } from 'src/video-converter/enums/video-converter-resolution.enum';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  getVideos() {
    return this.videosService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  createVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body() createVideoDto: CreateVideoDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.videosService.createVideoWithAsset(file, createVideoDto);
  }

  // Более специфичный роут должен быть перед общим :id
  @Get(':id/stream')
  async streamVideo(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const videoId = parseInt(id, 10);
    if (isNaN(videoId)) {
      throw new BadRequestException('Invalid video ID');
    }

    const rangeHeader = req.headers.range;
    const url = req.url;
    const queryFile = req.query.file as string | undefined;

    // Определяем тип запроса (HLS или обычный стриминг)
    const requestInfo = await this.videosService.getStreamRequestInfo(
      videoId,
      url,
      queryFile,
    );

    if (requestInfo.isHLS) {
      // Обработка HLS запросов
      const hlsStreamInfo = await this.videosService.getHLSStreamInfo(
        videoId,
        requestInfo.fileRequest || 'master.m3u8',
        rangeHeader,
      );

      // Устанавливаем заголовки для HLS
      res.setHeader('Content-Type', hlsStreamInfo.mimeType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      if (hlsStreamInfo.range) {
        // Range request для .ts файла
        const { start, end, chunkSize } = hlsStreamInfo.range;
        res.setHeader(
          'Content-Range',
          `bytes ${start}-${end}/${hlsStreamInfo.fileSize}`,
        );
        res.setHeader('Content-Length', chunkSize);
        res.status(HttpStatus.PARTIAL_CONTENT);

        const fileStream = this.videosService.createFileStream(
          hlsStreamInfo.filePath,
          start,
          end,
        );
        fileStream.pipe(res);
      } else {
        // Полный файл (.m3u8 или .ts без Range)
        res.setHeader('Content-Length', hlsStreamInfo.fileSize);
        res.status(HttpStatus.OK);

        const fileStream = this.videosService.createFileStream(
          hlsStreamInfo.filePath,
        );
        fileStream.pipe(res);
      }
      return;
    }

    // Обычный стриминг (mp4 или другой формат)
    const streamInfo = await this.videosService.getStreamInfo(
      videoId,
      rangeHeader,
    );

    // Устанавливаем общие заголовки
    res.setHeader('Content-Type', streamInfo.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Accept-Ranges, Content-Length',
    );

    if (streamInfo.range) {
      // Range request - Partial Content
      const { start, end, chunkSize } = streamInfo.range;
      res.setHeader(
        'Content-Range',
        `bytes ${start}-${end}/${streamInfo.fileSize}`,
      );
      res.setHeader('Content-Length', chunkSize);
      res.status(HttpStatus.PARTIAL_CONTENT);

      const fileStream = this.videosService.createFileStream(
        streamInfo.filePath,
        start,
        end,
      );
      fileStream.pipe(res);
    } else {
      // Полный файл
      res.setHeader('Content-Length', streamInfo.fileSize);
      res.status(HttpStatus.OK);

      const fileStream = this.videosService.createFileStream(
        streamInfo.filePath,
      );
      fileStream.pipe(res);
    }
  }

  // Обработка сегментов HLS без указания разрешения (по умолчанию 360p)
  // Пример: /videos/5/segments/000.ts
  @Get(':id/segments/:filename')
  async streamHLSSegmentDefault(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const videoId = parseInt(id, 10);
    if (isNaN(videoId)) {
      throw new BadRequestException('Invalid video ID');
    }

    // Проверяем, что это .ts файл
    if (!filename.endsWith('.ts')) {
      throw new NotFoundException('Invalid segment file');
    }

    const rangeHeader = req.headers.range;
    const defaultResolution = VideoConverterResolution.RESOLUTION_360P;

    // Используем существующую логику для получения HLS файла с разрешением по умолчанию
    const hlsStreamInfo = await this.videosService.getHLSStreamInfo(
      videoId,
      filename,
      rangeHeader,
      defaultResolution,
    );

    // Устанавливаем заголовки для HLS сегмента
    res.setHeader('Content-Type', hlsStreamInfo.mimeType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (hlsStreamInfo.range) {
      // Range request для .ts файла
      const { start, end, chunkSize } = hlsStreamInfo.range;
      res.setHeader(
        'Content-Range',
        `bytes ${start}-${end}/${hlsStreamInfo.fileSize}`,
      );
      res.setHeader('Content-Length', chunkSize);
      res.status(HttpStatus.PARTIAL_CONTENT);

      const fileStream = this.videosService.createFileStream(
        hlsStreamInfo.filePath,
        start,
        end,
      );
      fileStream.pipe(res);
    } else {
      // Полный файл (.ts без Range)
      res.setHeader('Content-Length', hlsStreamInfo.fileSize);
      res.status(HttpStatus.OK);

      const fileStream = this.videosService.createFileStream(
        hlsStreamInfo.filePath,
      );
      fileStream.pipe(res);
    }
  }

  // Обработка сегментов HLS с указанием разрешения в URL
  // Пример: /videos/5/360p/segments/000.ts
  @Get(':id/:resolution/segments/:filename')
  async streamHLSSegmentWithResolution(
    @Param('id') id: string,
    @Param('resolution') resolution: string,
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const videoId = parseInt(id, 10);
    if (isNaN(videoId)) {
      throw new BadRequestException('Invalid video ID');
    }

    // Валидируем разрешение
    const resolutionIndexMap = generateResolutionIndexMap();
    const validResolutions = Array.from(resolutionIndexMap.values());
    if (!validResolutions.includes(resolution)) {
      throw new BadRequestException(`Invalid resolution: ${resolution}`);
    }

    // Проверяем, что это .ts файл
    if (!filename.endsWith('.ts')) {
      throw new NotFoundException('Invalid segment file');
    }

    const rangeHeader = req.headers.range;

    // Используем существующую логику для получения HLS файла с указанным разрешением
    const hlsStreamInfo = await this.videosService.getHLSStreamInfo(
      videoId,
      filename,
      rangeHeader,
      resolution,
    );

    // Устанавливаем заголовки для HLS сегмента
    res.setHeader('Content-Type', hlsStreamInfo.mimeType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (hlsStreamInfo.range) {
      // Range request для .ts файла
      const { start, end, chunkSize } = hlsStreamInfo.range;
      res.setHeader(
        'Content-Range',
        `bytes ${start}-${end}/${hlsStreamInfo.fileSize}`,
      );
      res.setHeader('Content-Length', chunkSize);
      res.status(HttpStatus.PARTIAL_CONTENT);

      const fileStream = this.videosService.createFileStream(
        hlsStreamInfo.filePath,
        start,
        end,
      );
      fileStream.pipe(res);
    } else {
      // Полный файл (.ts без Range)
      res.setHeader('Content-Length', hlsStreamInfo.fileSize);
      res.status(HttpStatus.OK);

      const fileStream = this.videosService.createFileStream(
        hlsStreamInfo.filePath,
      );
      fileStream.pipe(res);
    }
  }

  // Обработка плейлистов конкретного разрешения
  // Пример: /videos/5/360p/playlist.m3u8 или /videos/5/360p/0.m3u8
  @Get(':id/:resolution/:filename')
  async streamHLSPlaylistWithResolution(
    @Param('id') id: string,
    @Param('resolution') resolution: string,
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const videoId = parseInt(id, 10);
    if (isNaN(videoId)) {
      throw new BadRequestException('Invalid video ID');
    }

    // Проверяем, что resolution не является зарезервированным словом
    if (resolution === 'stream') {
      throw new NotFoundException('Invalid resolution');
    }

    // Валидируем разрешение
    const resolutionIndexMap = generateResolutionIndexMap();
    const validResolutions = Array.from(resolutionIndexMap.values());
    if (!validResolutions.includes(resolution)) {
      throw new BadRequestException(`Invalid resolution: ${resolution}`);
    }

    // Проверяем, что это .m3u8 файл
    if (!filename.endsWith('.m3u8')) {
      throw new NotFoundException('Invalid playlist file');
    }

    // Используем существующую логику для получения HLS файла
    const hlsStreamInfo = await this.videosService.getHLSStreamInfo(
      videoId,
      filename,
      undefined,
      resolution,
    );

    // Устанавливаем заголовки для HLS плейлиста
    res.setHeader('Content-Type', hlsStreamInfo.mimeType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Length', hlsStreamInfo.fileSize);
    res.status(HttpStatus.OK);

    const fileStream = this.videosService.createFileStream(
      hlsStreamInfo.filePath,
    );
    fileStream.pipe(res);
  }

  // Обработка прямых запросов к HLS файлам от Video.js
  // Примеры: /videos/5/0.m3u8, /videos/5/master.m3u8
  @Get(':id/:filename')
  async streamHLSFile(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const videoId = parseInt(id, 10);
    if (isNaN(videoId)) {
      throw new BadRequestException('Invalid video ID');
    }

    // Проверяем, что это HLS файл
    if (!filename.endsWith('.m3u8') && !filename.endsWith('.ts')) {
      // Если это не HLS файл, передаем управление следующему роуту
      // Но так как это последний специфичный роут, вернем 404
      throw new NotFoundException('File not found');
    }

    const rangeHeader = req.headers.range;

    // Определяем разрешение по умолчанию для .ts файлов
    let defaultResolution: string | undefined;
    if (filename.endsWith('.ts')) {
      defaultResolution = VideoConverterResolution.RESOLUTION_360P;
    }

    // Используем существующую логику для получения HLS файла
    const hlsStreamInfo = await this.videosService.getHLSStreamInfo(
      videoId,
      filename,
      rangeHeader,
      defaultResolution,
    );

    // Устанавливаем заголовки для HLS
    res.setHeader('Content-Type', hlsStreamInfo.mimeType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (hlsStreamInfo.range) {
      // Range request для .ts файла
      const { start, end, chunkSize } = hlsStreamInfo.range;
      res.setHeader(
        'Content-Range',
        `bytes ${start}-${end}/${hlsStreamInfo.fileSize}`,
      );
      res.setHeader('Content-Length', chunkSize);
      res.status(HttpStatus.PARTIAL_CONTENT);

      const fileStream = this.videosService.createFileStream(
        hlsStreamInfo.filePath,
        start,
        end,
      );
      fileStream.pipe(res);
    } else {
      // Полный файл (.m3u8 или .ts без Range)
      res.setHeader('Content-Length', hlsStreamInfo.fileSize);
      res.status(HttpStatus.OK);

      const fileStream = this.videosService.createFileStream(
        hlsStreamInfo.filePath,
      );
      fileStream.pipe(res);
    }
  }

  @Get(':id')
  async getVideo(@Param('id') id: string) {
    const videoId = parseInt(id, 10);
    if (isNaN(videoId)) {
      throw new BadRequestException('Invalid video ID');
    }

    const video = await this.videosService.findOne(videoId);
    if (!video) {
      throw new NotFoundException(`Video with ID ${videoId} not found`);
    }

    return video;
  }
}
