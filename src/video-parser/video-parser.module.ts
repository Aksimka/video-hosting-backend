import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoParserController } from './video-parser.controller';
import { VideoParserService } from './video-parser.service';
import { ParsedVideo } from './entities/parsed-video.entity';
import { ParsedVideoSource } from './entities/parsed-video-source.entity';
import { ParserTag } from './entities/parser-tag.entity';
import { ParserVideoTag } from './entities/parser-video-tag.entity';
import { SexStudentkiVideoParserStrategy } from './strategies/sex-studentki-video-parser.strategy';
import { VideoParserRefreshScheduler } from './scheduler/video-parser-refresh.scheduler';
import { RawTagMapping } from 'src/tag-governance/entities/raw-tag-mapping.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParsedVideo, ParsedVideoSource]),
    TypeOrmModule.forFeature(
      [ParserTag, ParserVideoTag, RawTagMapping],
      'tags',
    ),
  ],
  controllers: [VideoParserController],
  providers: [
    VideoParserService,
    SexStudentkiVideoParserStrategy,
    VideoParserRefreshScheduler,
  ],
  exports: [VideoParserService],
})
export class VideoParserModule {}
