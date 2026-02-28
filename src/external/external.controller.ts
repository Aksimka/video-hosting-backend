import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InternalSyncTokenGuard } from 'src/common/guards/internal-sync-token.guard';
import { ExternalService } from './external.service';
import { ListPublicFeedDto } from './dto/list-public-feed.dto';

@Controller('external')
@UseGuards(InternalSyncTokenGuard)
export class ExternalController {
  constructor(private readonly externalService: ExternalService) {}

  @Get('public-feed')
  async getPublicFeed(@Query() query: ListPublicFeedDto) {
    return this.externalService.getPublicFeed(query);
  }

  @Get('categories')
  async getCategories() {
    return this.externalService.getActiveCategories();
  }
}
