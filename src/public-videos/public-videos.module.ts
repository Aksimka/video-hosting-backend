import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublishedVideo } from 'src/published-videos/published-video.entity';
import { PublicVideosService } from './public-videos.service';
import { PublicVideosController } from './public-videos.controller';
// Models in public response are temporarily disabled.
// Keep these imports as a reference for quick rollback:
// import { VideoRawModel } from 'src/tag-governance/entities/video-raw-model.entity';
// import { RawModelMapping } from 'src/tag-governance/entities/raw-model-mapping.entity';
// import { CanonicalModel } from 'src/tag-governance/entities/canonical-model.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PublishedVideo]),
    // TypeOrmModule.forFeature(
    //   [VideoRawModel, RawModelMapping, CanonicalModel],
    //   'tags',
    // ),
  ],
  providers: [PublicVideosService],
  controllers: [PublicVideosController],
  exports: [PublicVideosService],
})
export class PublicVideosModule {}
