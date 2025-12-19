import { VideoConverterResolution } from '../enums/video-converter-resolution.enum';

export const RESOLUTIONS_DATA = {
  [VideoConverterResolution.RESOLUTION_360P]: {
    width: 640,
    height: 360,
    videoBitrate: '800k',
    audioBitrate: '96k',
  },
  [VideoConverterResolution.RESOLUTION_480P]: {
    resolution: VideoConverterResolution.RESOLUTION_480P,
    width: 854,
    height: 480,
    videoBitrate: '1400k',
    audioBitrate: '128k',
  },
  [VideoConverterResolution.RESOLUTION_720P]: {
    resolution: VideoConverterResolution.RESOLUTION_720P,
    width: 1280,
    height: 720,
    videoBitrate: '2500k',
    audioBitrate: '128k',
  },
  [VideoConverterResolution.RESOLUTION_1080P]: {
    resolution: VideoConverterResolution.RESOLUTION_1080P,
    width: 1920,
    height: 1080,
    videoBitrate: '5000k',
    audioBitrate: '192k',
  },
} as const;
