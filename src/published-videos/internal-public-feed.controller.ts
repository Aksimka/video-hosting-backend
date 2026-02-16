import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PublishedVideosService } from './published-videos.service';
import { ListPublicFeedDto } from './dto/list-public-feed.dto';
import { InternalSyncTokenGuard } from 'src/common/guards/internal-sync-token.guard';

@Controller('internal/public-feed')
@UseGuards(InternalSyncTokenGuard)
export class InternalPublicFeedController {
  constructor(
    private readonly publishedVideosService: PublishedVideosService,
  ) {}

  @Get()
  async getFeed(@Query() query: ListPublicFeedDto) {
    return this.publishedVideosService.getPublicFeed(query);
  }
}
