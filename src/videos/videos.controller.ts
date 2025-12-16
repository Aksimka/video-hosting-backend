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

    // Получаем информацию о стриме из сервиса
    const rangeHeader = req.headers.range;
    const streamInfo = await this.videosService.getStreamInfo(
      videoId,
      rangeHeader,
    );

    // Устанавливаем общие заголовки
    res.setHeader('Content-Type', streamInfo.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    // CORS заголовки для стриминга
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
