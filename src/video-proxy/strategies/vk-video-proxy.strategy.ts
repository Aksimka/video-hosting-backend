import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { IVideoProxyStrategy } from '../interfaces/video-proxy-strategy.interface';

@Injectable()
export class VkVideoProxyStrategy implements IVideoProxyStrategy {
  /**
   * Проксирует видео запрос на VK CDN
   * @param req - Express Request объект
   * @param res - Express Response объект
   * @param params - Параметры запроса (пока не используются, но могут быть расширены)
   */
  async proxyVideo(
    req: Request,
    res: Response,
    params: Record<string, string>,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ignored = params;

    // ВНИМАНИЕ: В production это должно приходить из параметров запроса или конфигурации
    // Сейчас захардкожено для тестирования
    const targetUrl =
      'https://vkvd430.okcdn.ru/?expires=1766932030237&srcIp=178.148.115.116&pr=40&srcAg=CHROME_MAC&ms=45.136.21.155&type=3&sig=uiPh-uwdpqs&ct=21&urls=185.226.53.199&clientType=13&zs=43&id=7668704283149&bytes=0-11913049';

    const range = req.headers.range ?? 'bytes=0-';

    try {
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          Connection: 'keep-alive',
          Cookie: 'tstc=p',
          Range: range,
          Referer: targetUrl,
          'Sec-Fetch-Dest': 'video',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          'sec-ch-ua':
            '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
        },
        redirect: 'follow',
      });

      // Устанавливаем CORS заголовки ПЕРЕД установкой статуса
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Range, Accept-Ranges, Content-Length, Content-Type',
      );

      res.status(upstream.status);

      // Пробрасываем важные заголовки
      const contentType = upstream.headers.get('content-type');
      const contentLength = upstream.headers.get('content-length');
      const contentRange = upstream.headers.get('content-range');
      const acceptRanges = upstream.headers.get('accept-ranges');

      if (contentType) res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

      if (!upstream.body) {
        res.end();
        return;
      }

      // Стримим тело ответа без буферизации в память
      const nodeStream = Readable.fromWeb(upstream.body as unknown as never);
      await pipeline(nodeStream, res);
    } catch (e) {
      throw new HttpException(
        e instanceof Error ? e.message : 'Upstream request failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
