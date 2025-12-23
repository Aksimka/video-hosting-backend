import { BadRequestException } from '@nestjs/common';
import { generateResolutionIndexMap } from 'src/video-converter/utils/generateOutputOptions';

/**
 * Валидирует и парсит ID видео из строки
 * @param id - ID видео в виде строки
 * @returns Числовой ID видео
 * @throws BadRequestException при невалидном ID
 */
export function validateVideoId(id: string): number {
  const videoId = parseInt(id, 10);
  if (isNaN(videoId)) {
    throw new BadRequestException('Invalid video ID');
  }
  return videoId;
}

/**
 * Валидирует разрешение видео
 * @param resolution - Разрешение в виде строки (например, "360p")
 * @returns true если разрешение валидно
 * @throws BadRequestException при невалидном разрешении
 */
export function validateResolution(resolution: string): boolean {
  const resolutionIndexMap = generateResolutionIndexMap();
  const validResolutions = Array.from(resolutionIndexMap.values());

  if (!validResolutions.includes(resolution)) {
    throw new BadRequestException(`Invalid resolution: ${resolution}`);
  }

  return true;
}

