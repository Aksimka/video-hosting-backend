import { HttpException, HttpStatus } from '@nestjs/common';

export interface StreamRange {
  start: number;
  end: number;
  chunkSize: number;
}

/**
 * Парсит Range заголовок HTTP запроса
 * @param rangeHeader - Значение заголовка Range (например, "bytes=0-1023")
 * @param fileSize - Размер файла в байтах
 * @returns Объект с границами диапазона или null
 * @throws HttpException при невалидном Range заголовке
 */
export function parseRangeHeader(
  rangeHeader: string,
  fileSize: number,
): StreamRange {
  const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!rangeMatch) {
    throw new HttpException(
      'Invalid Range header',
      HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
    );
  }

  const start = parseInt(rangeMatch[1], 10);
  const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

  // Валидация границ
  if (
    isNaN(start) ||
    isNaN(end) ||
    start < 0 ||
    end >= fileSize ||
    start > end
  ) {
    throw new HttpException(
      'Range Not Satisfiable',
      HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
    );
  }

  // Вычисляем размер чанка
  const chunkSize = end - start + 1;

  return {
    start,
    end,
    chunkSize,
  };
}

/**
 * Мягкий парсинг Range заголовка для HLS (не выбрасывает исключения)
 * @param rangeHeader - Значение заголовка Range
 * @param fileSize - Размер файла в байтах
 * @returns Объект с границами диапазона или null при ошибке
 */
export function parseRangeHeaderSoft(
  rangeHeader: string,
  fileSize: number,
): StreamRange | null {
  const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!rangeMatch) {
    return null;
  }

  const start = parseInt(rangeMatch[1], 10);
  const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

  // Валидация границ (возвращаем null при ошибке вместо исключения)
  if (
    isNaN(start) ||
    isNaN(end) ||
    start < 0 ||
    end >= fileSize ||
    start > end
  ) {
    return null;
  }

  // Вычисляем размер чанка
  const chunkSize = end - start + 1;

  return {
    start,
    end,
    chunkSize,
  };
}

