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
      ],
      'tags',
    ),
  ],
  providers: [TagGovernanceService],
  controllers: [TagGovernanceController],
  exports: [TagGovernanceService],
})
export class TagGovernanceModule {}
