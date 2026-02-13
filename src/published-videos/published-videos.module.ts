import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublishedVideo } from './published-video.entity';
import { PublishedVideosService } from './published-videos.service';
import { PublishedVideosController } from './published-videos.controller';
import { ParsedVideo } from 'src/video-parser/entities/parsed-video.entity';
import { TagGovernanceModule } from 'src/tag-governance/tag-governance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PublishedVideo, ParsedVideo]),
    TagGovernanceModule,
  ],
  providers: [PublishedVideosService],
  controllers: [PublishedVideosController],
  exports: [PublishedVideosService],
})
export class PublishedVideosModule {}
