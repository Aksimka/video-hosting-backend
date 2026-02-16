import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublishedVideo } from './published-video.entity';
import { PublishedVideosService } from './published-videos.service';
import { PublishedVideosController } from './published-videos.controller';
import { InternalPublicFeedController } from './internal-public-feed.controller';
import { ParsedVideo } from 'src/video-parser/entities/parsed-video.entity';
import { TagGovernanceModule } from 'src/tag-governance/tag-governance.module';
import { InternalSyncTokenGuard } from 'src/common/guards/internal-sync-token.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([PublishedVideo, ParsedVideo]),
    TagGovernanceModule,
  ],
  providers: [PublishedVideosService, InternalSyncTokenGuard],
  controllers: [PublishedVideosController, InternalPublicFeedController],
  exports: [PublishedVideosService],
})
export class PublishedVideosModule {}
