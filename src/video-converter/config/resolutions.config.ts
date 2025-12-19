import { VideoConverterResolution } from '../enums/video-converter-resolution.enum';

export const SUPPORTED_RESOLUTIONS = [
  VideoConverterResolution.RESOLUTION_360P,
  // VideoConverterResolution.RESOLUTION_480P,
  // VideoConverterResolution.RESOLUTION_720P,
  // VideoConverterResolution.RESOLUTION_1080P,
] as const;
