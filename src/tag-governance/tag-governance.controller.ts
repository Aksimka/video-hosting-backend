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
import { TagGovernanceService } from './tag-governance.service';
import { CreateCanonicalTagDto } from './dto/create-canonical-tag.dto';
import { UpdateCanonicalTagDto } from './dto/update-canonical-tag.dto';
import { MapRawTagDto } from './dto/map-raw-tag.dto';
import { IgnoreRawTagDto } from './dto/ignore-raw-tag.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateCanonicalModelDto } from './dto/create-canonical-model.dto';
import { UpdateCanonicalModelDto } from './dto/update-canonical-model.dto';
import { MapRawModelDto } from './dto/map-raw-model.dto';
import { IgnoreRawModelDto } from './dto/ignore-raw-model.dto';

@Controller('admin/tag-governance')
export class TagGovernanceController {
  constructor(private readonly tagGovernanceService: TagGovernanceService) {}

  @Get('canonical-tags')
  async listCanonicalTags() {
    return this.tagGovernanceService.listCanonicalTags();
  }

  @Post('canonical-tags')
  @HttpCode(HttpStatus.OK)
  async createCanonicalTag(@Body() dto: CreateCanonicalTagDto) {
    return this.tagGovernanceService.createCanonicalTag(dto);
  }

  @Patch('canonical-tags/:id')
  async updateCanonicalTag(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCanonicalTagDto,
  ) {
    return this.tagGovernanceService.updateCanonicalTag(id, dto);
  }

  @Delete('canonical-tags/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCanonicalTag(@Param('id', ParseIntPipe) id: number) {
    await this.tagGovernanceService.deleteCanonicalTag(id);
  }

  @Get('canonical-models')
  async listCanonicalModels() {
    return this.tagGovernanceService.listCanonicalModels();
  }

  @Post('canonical-models')
  @HttpCode(HttpStatus.OK)
  async createCanonicalModel(@Body() dto: CreateCanonicalModelDto) {
    return this.tagGovernanceService.createCanonicalModel(dto);
  }

  @Patch('canonical-models/:id')
  async updateCanonicalModel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCanonicalModelDto,
  ) {
    return this.tagGovernanceService.updateCanonicalModel(id, dto);
  }

  @Delete('canonical-models/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCanonicalModel(@Param('id', ParseIntPipe) id: number) {
    await this.tagGovernanceService.deleteCanonicalModel(id);
  }

  @Get('raw-tags/unmapped')
  async listUnmappedRawTags(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    return this.tagGovernanceService.listUnmappedRawTags(
      parsedLimit,
      parsedOffset,
    );
  }

  @Patch('raw-tags/:rawTagId/map')
  async mapRawTag(
    @Param('rawTagId', ParseIntPipe) rawTagId: number,
    @Body() dto: MapRawTagDto,
  ) {
    return this.tagGovernanceService.mapRawTag(rawTagId, dto);
  }

  @Patch('raw-tags/:rawTagId/ignore')
  async ignoreRawTag(
    @Param('rawTagId', ParseIntPipe) rawTagId: number,
    @Body() dto: IgnoreRawTagDto,
  ) {
    return this.tagGovernanceService.ignoreRawTag(rawTagId, dto);
  }

  @Get('raw-models/unmapped')
  async listUnmappedRawModels(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    return this.tagGovernanceService.listUnmappedRawModels(
      parsedLimit,
      parsedOffset,
    );
  }

  @Patch('raw-models/:rawModelId/map')
  async mapRawModel(
    @Param('rawModelId', ParseIntPipe) rawModelId: number,
    @Body() dto: MapRawModelDto,
  ) {
    return this.tagGovernanceService.mapRawModel(rawModelId, dto);
  }

  @Patch('raw-models/:rawModelId/ignore')
  async ignoreRawModel(
    @Param('rawModelId', ParseIntPipe) rawModelId: number,
    @Body() dto: IgnoreRawModelDto,
  ) {
    return this.tagGovernanceService.ignoreRawModel(rawModelId, dto);
  }

  @Get('parsed-videos/:parsedVideoId/mapping-status')
  async getParsedVideoMappingStatus(
    @Param('parsedVideoId', ParseIntPipe) parsedVideoId: number,
  ) {
    return this.tagGovernanceService.getParsedVideoMappingStatus(parsedVideoId);
  }

  @Get('parsed-videos/:parsedVideoId/model-mapping-status')
  async getParsedVideoModelMappingStatus(
    @Param('parsedVideoId', ParseIntPipe) parsedVideoId: number,
  ) {
    return this.tagGovernanceService.getParsedVideoModelMappingStatus(
      parsedVideoId,
    );
  }

  @Get('categories')
  async listCategories() {
    return this.tagGovernanceService.listCategories();
  }

  @Post('categories')
  @HttpCode(HttpStatus.OK)
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.tagGovernanceService.createCategory(dto);
  }

  @Patch('categories/:id')
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.tagGovernanceService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    await this.tagGovernanceService.deleteCategory(id);
  }
}
