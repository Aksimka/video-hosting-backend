import {
  Controller,
  Get,
  Head,
  Options,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { VideoProxyService } from './video-proxy.service';

@Controller('video-proxy')
export class VideoProxyController {
  constructor(private readonly videoProxyService: VideoProxyService) {}

  /**
   * Обработка OPTIONS запросов для CORS preflight
   */
  @Options(':id')
  optionsProxy(@Res() res: Response): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Accept-Ranges, Content-Length, Content-Type',
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
  }

  /**
   * HEAD запрос для получения метаданных видео
   * Пример: HEAD /video-proxy/1
   */
  @Head(':id')
  async headProxy(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.videoProxyService.proxyVideo(id, req, res);
  }

  /**
   * Проксирование видео запроса
   * Пример: GET /video-proxy/1
   */
  @Get(':id')
  async proxyVideo(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.videoProxyService.proxyVideo(id, req, res);
  }
}
