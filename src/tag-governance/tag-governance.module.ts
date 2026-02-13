import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagGovernanceService } from './tag-governance.service';
import { TagGovernanceController } from './tag-governance.controller';
import { ParsedVideo } from 'src/video-parser/entities/parsed-video.entity';
import { ParserTag } from 'src/video-parser/entities/parser-tag.entity';
import { ParserVideoTag } from 'src/video-parser/entities/parser-video-tag.entity';
import { CanonicalTag } from './entities/canonical-tag.entity';
import { RawTagMapping } from './entities/raw-tag-mapping.entity';
import { Category } from './entities/category.entity';
import { CategoryCanonicalTag } from './entities/category-canonical-tag.entity';
import { RawModel } from './entities/raw-model.entity';
import { VideoRawModel } from './entities/video-raw-model.entity';
import { CanonicalModel } from './entities/canonical-model.entity';
import { RawModelMapping } from './entities/raw-model-mapping.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParsedVideo]),
    TypeOrmModule.forFeature(
      [
        ParserTag,
        ParserVideoTag,
        CanonicalTag,
        RawTagMapping,
        Category,
        CategoryCanonicalTag,
        RawModel,
        VideoRawModel,
        CanonicalModel,
        RawModelMapping,
      ],
      'tags',
    ),
  ],
  providers: [TagGovernanceService],
  controllers: [TagGovernanceController],
  exports: [TagGovernanceService],
})
export class TagGovernanceModule {}
