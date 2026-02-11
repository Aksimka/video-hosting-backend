import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublishedVideo } from 'src/published-videos/published-video.entity';
import { PublicVideosService } from './public-videos.service';
import { PublicVideosController } from './public-videos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PublishedVideo])],
  providers: [PublicVideosService],
  controllers: [PublicVideosController],
  exports: [PublicVideosService],
})
export class PublicVideosModule {}
