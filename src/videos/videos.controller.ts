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
  Param,
  Res,
  Req,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import * as fs from 'fs';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';

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

    // Получаем информацию о видео и файле
    const videoAssetResult = (await this.videosService.getVideoStreamInfo(
      videoId,
    )) as unknown as {
      file_path: string;
      mime_type: string;
    };

    // Извлекаем значения
    const assetObj = videoAssetResult;

    const filePath = assetObj.file_path;
    if (!filePath) {
      throw new HttpException('Video file not found', HttpStatus.NOT_FOUND);
    }

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      throw new HttpException('Video file not found', HttpStatus.NOT_FOUND);
    }

    const mimeType = assetObj.mime_type || 'video/mp4';

    // Получаем статистику файла для проверки размера
    const stats = fs.statSync(filePath);
    const actualFileSize = stats.size;

    // Парсим Range заголовок
    const rangeHeader = req.headers.range;

    if (!rangeHeader) {
      // Если Range не указан, возвращаем весь файл
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', actualFileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.status(HttpStatus.OK);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      return;
    }

    // Парсим Range: bytes=start-end или bytes=start-
    const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!rangeMatch) {
      throw new HttpException(
        'Invalid Range header',
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );
    }

    const start = parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2]
      ? parseInt(rangeMatch[2], 10)
      : actualFileSize - 1;

    // Валидация границ
    if (
      isNaN(start) ||
      isNaN(end) ||
      start < 0 ||
      end >= actualFileSize ||
      start > end
    ) {
      res.setHeader('Content-Range', `bytes */${actualFileSize}`);
      throw new HttpException(
        'Range Not Satisfiable',
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );
    }

    // Вычисляем размер чанка
    const chunkSize = end - start + 1;

    // Устанавливаем заголовки для Partial Content
    res.setHeader('Content-Range', `bytes ${start}-${end}/${actualFileSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', mimeType);
    res.status(HttpStatus.PARTIAL_CONTENT);

    // Создаем поток для чтения нужной части файла
    const fileStream = fs.createReadStream(filePath, {
      start,
      end,
    });

    fileStream.pipe(res);
  }
}
