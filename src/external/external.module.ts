import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalSyncTokenGuard } from 'src/common/guards/internal-sync-token.guard';
import { PublishedVideo } from 'src/published-videos/published-video.entity';
import { Category } from 'src/tag-governance/entities/category.entity';
import { ExternalController } from './external.controller';
import { ExternalService } from './external.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PublishedVideo]),
    TypeOrmModule.forFeature([Category], 'tags'),
  ],
  controllers: [ExternalController],
  providers: [ExternalService, InternalSyncTokenGuard],
})
export class ExternalModule {}
