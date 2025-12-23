import { Response } from 'express';
import { HttpStatus } from '@nestjs/common';
import { HLSStreamInfo } from '../videos.service';
import * as fs from 'fs';

/**
 * Отправляет HLS файл клиенту с правильными заголовками
 * @param res - Express Response объект
 * @param hlsStreamInfo - Информация о HLS файле
 * @param createFileStream - Функция для создания файлового потока
 */
export function sendHLSResponse(
  res: Response,
  hlsStreamInfo: HLSStreamInfo,
  createFileStream: (
    filePath: string,
    start?: number,
    end?: number,
  ) => fs.ReadStream,
): void {
  // Устанавливаем общие заголовки для HLS
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

    const fileStream = createFileStream(
      hlsStreamInfo.filePath,
      start,
      end,
    );
    fileStream.pipe(res);
  } else {
    // Полный файл (.m3u8 или .ts без Range)
    res.setHeader('Content-Length', hlsStreamInfo.fileSize);
    res.status(HttpStatus.OK);

    const fileStream = createFileStream(hlsStreamInfo.filePath);
    fileStream.pipe(res);
  }
}

