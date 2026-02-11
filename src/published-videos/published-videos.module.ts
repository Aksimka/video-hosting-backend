import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublishedVideo } from './published-video.entity';
import { PublishedVideosService } from './published-videos.service';
import { PublishedVideosController } from './published-videos.controller';
import { ParsedVideo } from 'src/video-parser/entities/parsed-video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PublishedVideo, ParsedVideo])],
  providers: [PublishedVideosService],
  controllers: [PublishedVideosController],
  exports: [PublishedVideosService],
})
export class PublishedVideosModule {}
