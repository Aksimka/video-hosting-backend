import { VideoConverterResolution } from 'src/video-converter/enums/video-converter-resolution.enum';
import {
  getDirectory,
  getFileName,
  joinPaths,
} from 'src/common/utils/path.util';

/**
 * Определяет путь к HLS файлу на основе типа запроса
 * @param masterPlaylistPath - Путь к master.m3u8 файлу
 * @param fileRequest - Запрашиваемый файл (например, "000.ts", "0.m3u8")
 * @param resolution - Разрешение видео (опционально, по умолчанию 360p)
 * @returns Путь к запрашиваемому файлу
 */
export function resolveHLSPath(
  masterPlaylistPath: string,
  fileRequest: string,
  resolution?: string,
): string {
  const masterPlaylistDir = getDirectory(masterPlaylistPath);
  const fileName = getFileName(fileRequest.split('/').pop() || fileRequest);

  // Master playlist
  if (fileName === 'master.m3u8' || fileRequest.includes('master.m3u8')) {
    return masterPlaylistPath;
  }

  // Media playlist (.m3u8 файлы в корне hls)
  if (fileName.endsWith('.m3u8')) {
    return joinPaths(masterPlaylistDir, fileName);
  }

  // TS сегменты (хранятся в папках по разрешениям)
  if (fileName.endsWith('.ts')) {
    const resolutionName =
      resolution || VideoConverterResolution.RESOLUTION_360P;

    const segmentsDir = joinPaths(
      masterPlaylistDir,
      resolutionName,
      'segments',
    );
    return joinPaths(segmentsDir, fileName);
  }

  // По умолчанию возвращаем master.m3u8
  return masterPlaylistPath;
}
