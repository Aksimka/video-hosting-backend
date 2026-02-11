import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PublishedVideosService } from './published-videos.service';
import { CreatePublishedVideoDto } from './dto/create-published-video.dto';
import { UpdatePublishedVideoDto } from './dto/update-published-video.dto';
import { PublishedVideoStatus } from './enums/published-video-status.enum';

@Controller('admin/published-videos')
export class PublishedVideosController {
  constructor(
    private readonly publishedVideosService: PublishedVideosService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() dto: CreatePublishedVideoDto) {
    return this.publishedVideosService.createFromParsed(dto);
  }

  @Get()
  async findAll(@Query('status') status?: PublishedVideoStatus) {
    return this.publishedVideosService.findAll(status);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.publishedVideosService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePublishedVideoDto,
  ) {
    return this.publishedVideosService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async hide(@Param('id', ParseIntPipe) id: number) {
    return this.publishedVideosService.hide(id);
  }

  @Post(':id/resync')
  @HttpCode(HttpStatus.OK)
  async resyncFromParsed(@Param('id', ParseIntPipe) id: number) {
    return this.publishedVideosService.resyncFromParsed(id);
  }
}
