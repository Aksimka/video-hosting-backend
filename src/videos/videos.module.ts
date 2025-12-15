import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from './video.entity';
import { VideoAsset } from 'src/videoAssets/videoAsset.entity';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { FileStorageModule } from 'src/file-storage/file-storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Video, VideoAsset]), FileStorageModule],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
