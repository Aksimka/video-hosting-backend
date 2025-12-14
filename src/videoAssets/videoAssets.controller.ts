import { Controller, Get } from '@nestjs/common';
import { VideoAssetsService } from './videoAssets.service';

@Controller('videoAssets')
export class VideoAssetsController {
  constructor(private readonly videoAssetsService: VideoAssetsService) {}

  @Get()
  getVideoAssets() {
    return this.videoAssetsService.findAll();
  }
}
