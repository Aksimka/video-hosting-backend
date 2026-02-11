import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { PublicVideosService } from './public-videos.service';
import { ListPublicVideosDto } from './dto/list-public-videos.dto';

@Controller('public/videos')
export class PublicVideosController {
  constructor(private readonly publicVideosService: PublicVideosService) {}

  @Get()
  async findAll(@Query() query: ListPublicVideosDto) {
    return this.publicVideosService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.publicVideosService.findOne(id);
  }
}
