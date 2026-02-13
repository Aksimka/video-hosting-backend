import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ParserTag } from 'src/video-parser/entities/parser-tag.entity';
import { ParserVideoTag } from 'src/video-parser/entities/parser-video-tag.entity';
import { ParsedVideo } from 'src/video-parser/entities/parsed-video.entity';
import { CanonicalTag } from './entities/canonical-tag.entity';
import { RawTagMapping } from './entities/raw-tag-mapping.entity';
import { RawTagMappingStatus } from './enums/raw-tag-mapping-status.enum';
import { CreateCanonicalTagDto } from './dto/create-canonical-tag.dto';
import { UpdateCanonicalTagDto } from './dto/update-canonical-tag.dto';
import { MapRawTagDto } from './dto/map-raw-tag.dto';
import { IgnoreRawTagDto } from './dto/ignore-raw-tag.dto';
import { Category } from './entities/category.entity';
import { CategoryCanonicalTag } from './entities/category-canonical-tag.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryMatchMode } from './enums/category-match-mode.enum';

@Injectable()
export class TagGovernanceService {
  constructor(
    @InjectRepository(ParsedVideo)
    private readonly parsedVideoRepository: Repository<ParsedVideo>,
    @InjectRepository(ParserTag, 'tags')
    private readonly parserTagRepository: Repository<ParserTag>,
    @InjectRepository(ParserVideoTag, 'tags')
    private readonly parserVideoTagRepository: Repository<ParserVideoTag>,
    @InjectRepository(CanonicalTag, 'tags')
    private readonly canonicalTagRepository: Repository<CanonicalTag>,
    @InjectRepository(RawTagMapping, 'tags')
    private readonly rawTagMappingRepository: Repository<RawTagMapping>,
    @InjectRepository(Category, 'tags')
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CategoryCanonicalTag, 'tags')
    private readonly categoryCanonicalTagRepository: Repository<CategoryCanonicalTag>,
  ) {}

  async ensureMappingsForRawTagIds(rawTagIds: number[]): Promise<void> {
    const uniqueTagIds = Array.from(new Set(rawTagIds)).filter((id) => id > 0);
    if (uniqueTagIds.length === 0) {
      return;
    }

    const existingMappings = await this.rawTagMappingRepository.find({
      where: {
        raw_tag_id: In(uniqueTagIds),
      },
      select: ['raw_tag_id'],
    });

    const existingIds = new Set(
      existingMappings.map((mapping) => mapping.raw_tag_id),
    );

    const toCreate = uniqueTagIds.filter((id) => !existingIds.has(id));
    if (toCreate.length === 0) {
      return;
    }

    await this.rawTagMappingRepository.save(
      toCreate.map((rawTagId) =>
        this.rawTagMappingRepository.create({
          raw_tag_id: rawTagId,
          status: RawTagMappingStatus.UNMAPPED,
          canonical_tag_id: null,
        }),
      ),
    );
  }

  async assertParsedVideoReadyForPublish(parsedVideoId: number): Promise<void> {
    const status = await this.getParsedVideoMappingStatus(parsedVideoId);

    if (status.unmappedCount > 0) {
      const labels = status.unmapped.map((item) => item.rawTag.name);
      throw new BadRequestException(
        `Video has unmapped tags and cannot be published: ${labels.join(', ')}`,
      );
    }
  }

  async getParsedVideoMappingStatus(parsedVideoId: number): Promise<{
    parsedVideoId: number;
    totalRawTags: number;
    mappedCount: number;
    ignoredCount: number;
    unmappedCount: number;
    unmapped: Array<{
      mappingId: number;
      rawTag: {
        id: number;
        site: string;
        name: string;
        slug: string;
      };
    }>;
  }> {
    const parsedVideo = await this.parsedVideoRepository.findOneBy({
      id: parsedVideoId,
    });

    if (!parsedVideo) {
      throw new NotFoundException(
        `Parsed video with id ${parsedVideoId} not found`,
      );
    }

    const externalKey = this.buildExternalVideoKey(
      parsedVideo.site,
      parsedVideo.page_url,
    );

    const videoTags = await this.parserVideoTagRepository.find({
      where: {
        site: parsedVideo.site,
        video_external_key: externalKey,
      },
    });

    const rawTagIds = videoTags.map((link) => link.tag_id);

    await this.ensureMappingsForRawTagIds(rawTagIds);

    if (rawTagIds.length === 0) {
      return {
        parsedVideoId,
        totalRawTags: 0,
        mappedCount: 0,
        ignoredCount: 0,
        unmappedCount: 0,
        unmapped: [],
      };
    }

    const mappings = await this.rawTagMappingRepository.find({
      where: {
        raw_tag_id: In(rawTagIds),
      },
      relations: ['raw_tag', 'canonical_tag'],
      order: {
        id: 'ASC',
      },
    });

    const mappedCount = mappings.filter(
      (mapping) =>
        mapping.status === RawTagMappingStatus.MAPPED &&
        mapping.canonical_tag_id !== null,
    ).length;

    const ignoredCount = mappings.filter(
      (mapping) => mapping.status === RawTagMappingStatus.IGNORED,
    ).length;

    const unmapped = mappings
      .filter(
        (mapping) =>
          mapping.status !== RawTagMappingStatus.IGNORED &&
          (mapping.status !== RawTagMappingStatus.MAPPED ||
            mapping.canonical_tag_id === null),
      )
      .map((mapping) => ({
        mappingId: mapping.id,
        rawTag: {
          id: mapping.raw_tag.id,
          site: mapping.raw_tag.site,
          name: mapping.raw_tag.name,
          slug: mapping.raw_tag.slug,
        },
      }));

    return {
      parsedVideoId,
      totalRawTags: mappings.length,
      mappedCount,
      ignoredCount,
      unmappedCount: unmapped.length,
      unmapped,
    };
  }

  async listUnmappedRawTags(limit = 50, offset = 0) {
    const [rows, total] = await this.rawTagMappingRepository.findAndCount({
      where: {
        status: RawTagMappingStatus.UNMAPPED,
      },
      relations: ['raw_tag'],
      order: { updated_at: 'ASC', id: 'ASC' },
      take: Math.max(1, Math.min(limit, 200)),
      skip: Math.max(0, offset),
    });

    return {
      items: rows.map((row) => ({
        mappingId: row.id,
        rawTag: {
          id: row.raw_tag.id,
          site: row.raw_tag.site,
          name: row.raw_tag.name,
          slug: row.raw_tag.slug,
          type: row.raw_tag.type,
        },
      })),
      total,
      limit,
      offset,
    };
  }

  async mapRawTag(rawTagId: number, dto: MapRawTagDto): Promise<RawTagMapping> {
    const mapping = await this.getOrCreateRawTagMapping(rawTagId);

    const canonicalTag = await this.canonicalTagRepository.findOneBy({
      id: dto.canonicalTagId,
    });

    if (!canonicalTag) {
      throw new NotFoundException(
        `Canonical tag with id ${dto.canonicalTagId} not found`,
      );
    }

    mapping.canonical_tag_id = canonicalTag.id;
    mapping.status = RawTagMappingStatus.MAPPED;
    mapping.mapped_at = new Date();
    mapping.mapped_by = dto.mappedBy || null;

    return this.rawTagMappingRepository.save(mapping);
  }

  async ignoreRawTag(
    rawTagId: number,
    dto: IgnoreRawTagDto,
  ): Promise<RawTagMapping> {
    const mapping = await this.getOrCreateRawTagMapping(rawTagId);

    mapping.canonical_tag_id = null;
    mapping.status = RawTagMappingStatus.IGNORED;
    mapping.mapped_at = new Date();
    mapping.mapped_by = dto.mappedBy || null;

    return this.rawTagMappingRepository.save(mapping);
  }

  async listCanonicalTags(): Promise<CanonicalTag[]> {
    return this.canonicalTagRepository.find({
      order: { name: 'ASC' },
    });
  }

  async createCanonicalTag(dto: CreateCanonicalTagDto): Promise<CanonicalTag> {
    const slug = this.normalizeSlug(dto.slug);
    const existing = await this.canonicalTagRepository.findOneBy({ slug });
    if (existing) {
      throw new BadRequestException(
        `Canonical tag with slug ${slug} already exists`,
      );
    }

    const created = this.canonicalTagRepository.create({
      name: dto.name.trim(),
      slug,
      is_active: dto.isActive ?? true,
    });

    return this.canonicalTagRepository.save(created);
  }

  async updateCanonicalTag(
    id: number,
    dto: UpdateCanonicalTagDto,
  ): Promise<CanonicalTag> {
    const tag = await this.canonicalTagRepository.findOneBy({ id });
    if (!tag) {
      throw new NotFoundException(`Canonical tag with id ${id} not found`);
    }

    if (dto.slug !== undefined) {
      const slug = this.normalizeSlug(dto.slug);
      const duplicate = await this.canonicalTagRepository.findOneBy({ slug });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(
          `Canonical tag with slug ${slug} already exists`,
        );
      }
      tag.slug = slug;
    }

    if (dto.name !== undefined) {
      tag.name = dto.name.trim();
    }
    if (dto.isActive !== undefined) {
      tag.is_active = dto.isActive;
    }

    return this.canonicalTagRepository.save(tag);
  }

  async deleteCanonicalTag(id: number): Promise<void> {
    await this.canonicalTagRepository.delete(id);
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = this.normalizeSlug(dto.slug);
    const exists = await this.categoryRepository.findOneBy({ slug });
    if (exists) {
      throw new BadRequestException(
        `Category with slug ${slug} already exists`,
      );
    }

    await this.assertCanonicalTagsExist(dto.canonicalTagIds);

    const category = this.categoryRepository.create({
      name: dto.name.trim(),
      slug,
      match_mode: dto.matchMode || CategoryMatchMode.ANY,
      is_active: dto.isActive ?? true,
    });

    const saved = await this.categoryRepository.save(category);

    await this.replaceCategoryTags(saved.id, dto.canonicalTagIds);

    return this.getCategory(saved.id);
  }

  async listCategories() {
    const categories = await this.categoryRepository.find({
      order: { name: 'ASC' },
    });

    return Promise.all(
      categories.map((category) => this.getCategory(category.id)),
    );
  }

  async getCategory(categoryId: number) {
    const category = await this.categoryRepository.findOneBy({
      id: categoryId,
    });
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }

    const links = await this.categoryCanonicalTagRepository.find({
      where: { category_id: category.id },
    });
    const canonicalTagIds = links.map((link) => link.canonical_tag_id);
    const tags =
      canonicalTagIds.length > 0
        ? await this.canonicalTagRepository.findBy({ id: In(canonicalTagIds) })
        : [];

    return {
      ...category,
      canonicalTags: tags,
    };
  }

  async updateCategory(categoryId: number, dto: UpdateCategoryDto) {
    const category = await this.categoryRepository.findOneBy({
      id: categoryId,
    });
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }

    if (dto.name !== undefined) {
      category.name = dto.name.trim();
    }

    if (dto.slug !== undefined) {
      const slug = this.normalizeSlug(dto.slug);
      const duplicate = await this.categoryRepository.findOneBy({ slug });
      if (duplicate && duplicate.id !== categoryId) {
        throw new BadRequestException(
          `Category with slug ${slug} already exists`,
        );
      }
      category.slug = slug;
    }

    if (dto.matchMode !== undefined) {
      category.match_mode = dto.matchMode;
    }

    if (dto.isActive !== undefined) {
      category.is_active = dto.isActive;
    }

    await this.categoryRepository.save(category);

    if (dto.canonicalTagIds !== undefined) {
      await this.assertCanonicalTagsExist(dto.canonicalTagIds);
      await this.replaceCategoryTags(category.id, dto.canonicalTagIds);
    }

    return this.getCategory(category.id);
  }

  async deleteCategory(categoryId: number): Promise<void> {
    await this.categoryRepository.delete(categoryId);
  }

  private async getOrCreateRawTagMapping(
    rawTagId: number,
  ): Promise<RawTagMapping> {
    const rawTag = await this.parserTagRepository.findOneBy({ id: rawTagId });
    if (!rawTag) {
      throw new NotFoundException(`Raw tag with id ${rawTagId} not found`);
    }

    const existing = await this.rawTagMappingRepository.findOne({
      where: {
        raw_tag_id: rawTagId,
      },
      relations: ['raw_tag', 'canonical_tag'],
    });

    if (existing) {
      return existing;
    }

    const created = this.rawTagMappingRepository.create({
      raw_tag_id: rawTagId,
      status: RawTagMappingStatus.UNMAPPED,
      canonical_tag_id: null,
    });

    return this.rawTagMappingRepository.save(created);
  }

  private async assertCanonicalTagsExist(
    canonicalTagIds: number[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(canonicalTagIds));
    const tags = await this.canonicalTagRepository.findBy({
      id: In(uniqueIds),
    });

    if (tags.length !== uniqueIds.length) {
      throw new BadRequestException('Some canonical tags do not exist');
    }
  }

  private async replaceCategoryTags(
    categoryId: number,
    canonicalTagIds: number[],
  ): Promise<void> {
    await this.categoryCanonicalTagRepository.delete({
      category_id: categoryId,
    });

    const uniqueIds = Array.from(new Set(canonicalTagIds));
    if (uniqueIds.length === 0) {
      return;
    }

    await this.categoryCanonicalTagRepository.save(
      uniqueIds.map((canonicalTagId) =>
        this.categoryCanonicalTagRepository.create({
          category_id: categoryId,
          canonical_tag_id: canonicalTagId,
        }),
      ),
    );
  }

  private buildExternalVideoKey(site: string, pageUrl: string): string {
    return `${site}|${pageUrl}`;
  }

  private normalizeSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9а-яё_-]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
