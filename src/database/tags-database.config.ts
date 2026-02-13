import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ParserTag } from 'src/video-parser/entities/parser-tag.entity';
import { ParserVideoTag } from 'src/video-parser/entities/parser-video-tag.entity';
import { CanonicalTag } from 'src/tag-governance/entities/canonical-tag.entity';
import { RawTagMapping } from 'src/tag-governance/entities/raw-tag-mapping.entity';
import { Category } from 'src/tag-governance/entities/category.entity';
import { CategoryCanonicalTag } from 'src/tag-governance/entities/category-canonical-tag.entity';

export const tagsDatabaseConfig: TypeOrmModuleOptions = {
  name: 'tags',
  type: 'postgres',
  host: process.env.TAGS_DB_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.TAGS_DB_PORT || process.env.DB_PORT || '5432', 10),
  username:
    process.env.TAGS_DB_USERNAME || process.env.DB_USERNAME || 'postgres',
  password:
    process.env.TAGS_DB_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  database:
    process.env.TAGS_DB_DATABASE || process.env.DB_DATABASE || 'postgres',
  entities: [
    ParserTag,
    ParserVideoTag,
    CanonicalTag,
    RawTagMapping,
    Category,
    CategoryCanonicalTag,
  ],
  synchronize:
    process.env.TAGS_DB_SYNCHRONIZE === 'true' ||
    process.env.DB_SYNCHRONIZE === 'true' ||
    true,
};
