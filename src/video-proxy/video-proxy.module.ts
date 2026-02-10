import { Module } from '@nestjs/common';
import { VideoProxyController } from './video-proxy.controller';
import { VideoProxyService } from './video-proxy.service';
import { VkVideoProxyStrategy } from './strategies/vk-video-proxy.strategy';

@Module({
  controllers: [VideoProxyController],
  providers: [VideoProxyService, VkVideoProxyStrategy],
  exports: [VideoProxyService],
})
export class VideoProxyModule {}
