import { SUPPORTED_RESOLUTIONS } from '../config/resolutions.config';
import { RESOLUTIONS_DATA } from '../constants/resolutionsData.constants';
import { VideoConverterResolution } from '../enums/video-converter-resolution.enum';
import { joinPaths } from 'src/common/utils/path.util';

/**
 * Генерирует маппинг индексов разрешений на их названия на основе SUPPORTED_RESOLUTIONS
 * @returns Map где ключ - индекс разрешения, значение - название (например, '360p', '720p')
 */
export const generateResolutionIndexMap = (): Map<number, string> => {
  const map = new Map<number, string>();
  SUPPORTED_RESOLUTIONS.forEach((resolution, index) => {
    // Значение enum уже содержит название разрешения ('360p', '720p' и т.д.)
    map.set(index, resolution);
  });
  return map;
};

export const getResolutionsData = () => {
  return SUPPORTED_RESOLUTIONS.reduce(
    (acc: string[], resolution: VideoConverterResolution, index: number) => {
      acc = [
        ...acc,
        `-s:v:${index} ${RESOLUTIONS_DATA[resolution].width}x${RESOLUTIONS_DATA[resolution].height}`,
        `-b:v:${index} ${RESOLUTIONS_DATA[resolution].videoBitrate}`,
        `-b:a:${index} ${RESOLUTIONS_DATA[resolution].audioBitrate}`,
        '-map 0:v:0',
        '-map 0:a:0',
      ];
      return acc;
    },
    [],
  );
};

export const generateOutputOptions = (
  hlsDir: string,
  resolutionIndexMap: Map<number, string>,
): string[] => {
  const optionsBody = [
    '-c:v libx264',
    '-c:a aac',
    '-hls_time 10',
    '-hls_playlist_type vod',
    '-master_pl_name master.m3u8',
    '-var_stream_map',
  ];

  // Генерируем опцию -hls_segment_filename для каждого разрешения
  // Формат: hls/{resolution}/segments/%03d.ts
  // Важно: итерируемся по индексам в порядке, чтобы соответствовать порядку в SUPPORTED_RESOLUTIONS
  const segmentFilenames: string[] = [];
  const maxIndex = Math.max(...Array.from(resolutionIndexMap.keys()));
  for (let index = 0; index <= maxIndex; index++) {
    const resolutionName = resolutionIndexMap.get(index);
    if (resolutionName) {
      const resolutionSegmentsDir = joinPaths(
        hlsDir,
        resolutionName,
        'segments',
      );
      segmentFilenames.push(
        `-hls_segment_filename`,
        joinPaths(resolutionSegmentsDir, '%03d.ts'),
      );
    }
  }

  // Добавляем опции сегментов перед -var_stream_map
  optionsBody.splice(-1, 0, ...segmentFilenames);

  const resolutionsOptionMapping = SUPPORTED_RESOLUTIONS.map(
    (_, index) => `v:${index},a:${index}`,
  );

  optionsBody.push(resolutionsOptionMapping.join(' '));

  optionsBody.push(...getResolutionsData());

  return optionsBody;
};

/**
 * Разделяет массив опций FFmpeg на опции без -var_stream_map и его значение.
 * Это необходимо, потому что fluent-ffmpeg требует передавать -var_stream_map
 * и его значение отдельно через .outputOption() для корректной обработки пробелов.
 */
export const splitVarStreamMapOption = (
  options: string[],
): { optionsWithoutVarStreamMap: string[]; varStreamMapValue: string } => {
  const varStreamMapIndex = options.indexOf('-var_stream_map');

  if (varStreamMapIndex === -1) {
    return {
      optionsWithoutVarStreamMap: options,
      varStreamMapValue: '',
    };
  }

  const varStreamMapValue = options[varStreamMapIndex + 1] || '';
  const optionsWithoutVarStreamMap = [
    ...options.slice(0, varStreamMapIndex),
    ...options.slice(varStreamMapIndex + 2),
  ];

  return {
    optionsWithoutVarStreamMap,
    varStreamMapValue,
  };
};
