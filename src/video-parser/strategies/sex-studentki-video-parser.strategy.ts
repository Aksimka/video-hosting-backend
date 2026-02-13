import { Injectable, Logger } from '@nestjs/common';
import { IVideoParserStrategy } from '../interfaces/video-parser-strategy.interface';
import {
  ParsedCategoryResult,
  ParsedModelData,
  ParsedTagData,
  ParsedVideoData,
} from '../interfaces/parsed-video-data.interface';
import { ParserVideoSite } from '../enums/parser-video-site.enum';
import { ParserTagType } from '../enums/parser-tag-type.enum';

@Injectable()
export class SexStudentkiVideoParserStrategy implements IVideoParserStrategy {
  private readonly logger = new Logger(SexStudentkiVideoParserStrategy.name);
  private static readonly USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  canHandleUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname.includes('sex-studentki.live');
    } catch {
      return false;
    }
  }

  async parseCategory(categoryUrl: string): Promise<ParsedCategoryResult> {
    const normalizedCategoryUrl = this.normalizeUrl(categoryUrl);
    const html = await this.fetchHtml(normalizedCategoryUrl);

    const itemRegex =
      /<div id="(?<mediaId>\d+)"[^>]*class="[^"]*video[^"]*trailer[^"]*"[\s\S]*?<a href="(?<href>\/video\/[^"]+)"[^>]*>[\s\S]*?<img class="image" src="(?<thumbnail>[^"]+)"[\s\S]*?<div class="title"[^>]*>(?<title>[\s\S]*?)<\/div>[\s\S]*?<span class="info-column column-time">[\s\S]*?<span>(?<duration>\d{1,2}:\d{2})<\/span>/g;

    const seen = new Set<string>();
    const items = [] as ParsedCategoryResult['items'];

    for (const match of html.matchAll(itemRegex)) {
      const href = match.groups?.href;
      if (!href) {
        continue;
      }

      const pageUrl = this.toAbsoluteUrl(href, normalizedCategoryUrl);
      if (seen.has(pageUrl)) {
        continue;
      }
      seen.add(pageUrl);

      items.push({
        pageUrl,
        mediaId: match.groups?.mediaId || undefined,
        title: this.cleanText(match.groups?.title || ''),
        durationSeconds: this.parseClockDuration(match.groups?.duration || ''),
        thumbnailUrl: this.toAbsoluteUrl(
          match.groups?.thumbnail || '',
          normalizedCategoryUrl,
        ),
      });
    }

    return {
      site: ParserVideoSite.SEX_STUDENTKI,
      categoryUrl: normalizedCategoryUrl,
      items,
    };
  }

  async parseVideo(videoUrl: string): Promise<ParsedVideoData> {
    const normalizedVideoUrl = this.normalizeUrl(videoUrl);
    const html = await this.fetchHtml(normalizedVideoUrl);

    const canonicalUrl =
      this.matchSingle(html, /<link rel="canonical" href="([^"]+)"/i) ||
      normalizedVideoUrl;

    const h1RawTitle =
      this.matchSingle(
        html,
        /<h1[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h1>/i,
      ) || '';
    const h1TitleWithoutViews = h1RawTitle.replace(
      /<span class="views-block"[\s\S]*?<\/span>/i,
      '',
    );
    const title =
      this.cleanText(h1TitleWithoutViews) ||
      this.cleanText(
        this.matchSingle(
          html,
          /<meta property="og:title" content="([^"]+)"/i,
        ) || '',
      );

    const description = this.cleanText(
      this.matchSingle(
        html,
        /<span class="description-text"[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/span>/i,
      ) || '',
    );

    const videoDurationVar = this.matchSingle(
      html,
      /var VIDEO_DURATION = '([0-9]+)'/i,
    );
    const durationFromIso = this.parseIsoDuration(
      this.matchSingle(html, /<meta itemprop="duration" content="([^"]+)"/i) ||
        '',
    );
    const durationSeconds = videoDurationVar
      ? parseInt(videoDurationVar, 10)
      : durationFromIso;

    const mediaId =
      this.matchSingle(html, /var VIDEO_ID = '([0-9]+)'/i) || undefined;

    const pageSlugId = this.extractPageSlugId(canonicalUrl);

    const thumbnailUrl =
      this.toAbsoluteUrl(
        this.matchSingle(
          html,
          /<link itemprop="thumbnailUrl" href="([^"]+)"/i,
        ) ||
          this.matchSingle(
            html,
            /<meta property="og:image" content="([^"]+)"/i,
          ) ||
          '',
        canonicalUrl,
      ) || undefined;

    const posterUrl =
      this.toAbsoluteUrl(
        this.matchSingle(html, /<video[^>]*poster="([^"]+)"/i) || '',
        canonicalUrl,
      ) || undefined;

    const playerSourceUrl =
      this.toAbsoluteUrl(this.extractPlayerSourceUrl(html), canonicalUrl) ||
      undefined;

    const timelineSpriteTemplateUrlRaw =
      this.toAbsoluteUrl(
        this.matchSingle(
          html,
          /main\.initPlayer\([\s\S]*?,\s*'([^']+\{d\}[^']*)'\s*\);/i,
        ) || '',
        canonicalUrl,
      ) || undefined;
    const timelineSpriteTemplateUrl = timelineSpriteTemplateUrlRaw?.replace(
      /%7Bd%7D/gi,
      '{d}',
    );

    const tags = this.parseTags(html, canonicalUrl);
    const models = this.parseModels(html);

    const trailerMp4Url = mediaId
      ? `https://m.sex-studentki.live/images/trailer/${mediaId}.mp4?3`
      : undefined;

    const trailerWebmUrl = mediaId
      ? `https://m.sex-studentki.live/images/trailer/${mediaId}.webm?3`
      : undefined;

    if (!title) {
      this.logger.warn(`Title not found for ${normalizedVideoUrl}`);
    }

    return {
      site: ParserVideoSite.SEX_STUDENTKI,
      pageUrl: canonicalUrl,
      pageSlugId,
      mediaId,
      title: title || canonicalUrl,
      description: description || undefined,
      durationSeconds,
      thumbnailUrl,
      posterUrl,
      trailerMp4Url,
      trailerWebmUrl,
      playerSourceUrl,
      timelineSpriteTemplateUrl,
      tags,
      models,
    };
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': SexStudentkiVideoParserStrategy.USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: 'https://sex-studentki.live/',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}. Status: ${response.status}`);
    }

    return response.text();
  }

  private parseTags(html: string, baseUrl: string): ParsedTagData[] {
    const tags: ParsedTagData[] = [];
    const uniqueMap = new Map<string, ParsedTagData>();

    const tagsAltBlock =
      this.matchSingle(
        html,
        /<div class="tags-alt info-rows"[\s\S]*?<\/div>\s*<\/div>\s*<script>/i,
      ) || '';

    const infoRowRegex =
      /<span class="info-row">[\s\S]*?<b class="info-row-label">[\s\S]*?<\/i>\s*([^:<]+):<\/b>([\s\S]*?)<\/span>/g;

    for (const rowMatch of tagsAltBlock.matchAll(infoRowRegex)) {
      const groupLabel = this.cleanText(rowMatch[1]);
      const linksBlock = rowMatch[2];
      const linkRegex = /<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

      for (const tagMatch of linksBlock.matchAll(linkRegex)) {
        const slug = this.extractSlug(tagMatch[1]);
        const name = this.cleanText(tagMatch[2]);
        if (!name || !slug) {
          continue;
        }

        const tag: ParsedTagData = {
          name,
          slug,
          type: ParserTagType.TAG,
          groupLabel: groupLabel || undefined,
        };
        uniqueMap.set(`${tag.type}:${tag.slug}`, tag);
      }
    }

    if (!tagsAltBlock) {
      const fallbackTagsRegex =
        /<div class="tags info-rows">[\s\S]*?<span class="info-row">([\s\S]*?)<\/span>/i;
      const fallbackTagsBlock = this.matchSingle(html, fallbackTagsRegex) || '';
      const linkRegex = /<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

      for (const tagMatch of fallbackTagsBlock.matchAll(linkRegex)) {
        const slug = this.extractSlug(tagMatch[1]);
        const name = this.cleanText(tagMatch[2]);
        if (!name || !slug) {
          continue;
        }

        const tag: ParsedTagData = {
          name,
          slug,
          type: ParserTagType.TAG,
        };
        uniqueMap.set(`${tag.type}:${tag.slug}`, tag);
      }
    }

    tags.push(...uniqueMap.values());

    return tags.filter((tag) => {
      const url = this.toAbsoluteUrl(`/${tag.slug}`, baseUrl);
      return !!url;
    });
  }

  private parseModels(html: string): ParsedModelData[] {
    const models: ParsedModelData[] = [];
    const uniqueMap = new Map<string, ParsedModelData>();

    const modelRegex =
      /<a class="tag-modifier" href="([^"]+)"[^>]*>[\s\S]*?<span itemprop="name">([^<]+)<\/span>/g;

    for (const modelMatch of html.matchAll(modelRegex)) {
      const slug = this.extractSlug(modelMatch[1]);
      const name = this.cleanText(modelMatch[2]);
      if (!name || !slug) {
        continue;
      }

      const model: ParsedModelData = {
        name,
        slug,
      };

      uniqueMap.set(model.slug, model);
    }

    models.push(...uniqueMap.values());
    return models;
  }

  private extractSlug(href: string): string {
    try {
      const absolute = this.toAbsoluteUrl(href, 'https://sex-studentki.live/');
      if (!absolute) {
        return '';
      }
      const parsed = new URL(absolute);
      return decodeURIComponent(parsed.pathname.replace(/^\/+|\/+$/g, ''));
    } catch {
      return '';
    }
  }

  private parseClockDuration(input: string): number | undefined {
    const normalized = input.trim();
    if (!normalized) {
      return undefined;
    }

    const parts = normalized.split(':').map((part) => parseInt(part, 10));
    if (parts.some((value) => Number.isNaN(value))) {
      return undefined;
    }

    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return undefined;
  }

  private parseIsoDuration(input: string): number | undefined {
    const match = input.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
    if (!match) {
      return undefined;
    }

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  private extractPageSlugId(url: string): string | undefined {
    const match = url.match(/-([0-9]+)(?:$|[/?#])/);
    return match?.[1];
  }

  private extractPlayerSourceUrl(html: string): string {
    const playerBlock =
      this.matchSingle(
        html,
        /<video[^>]*id="player"[^>]*>[\s\S]*?<\/video>/i,
      ) || '';

    if (!playerBlock) {
      return '';
    }

    // Parse source only inside the real player block to avoid commented stubs.
    return (
      this.matchSingle(
        playerBlock,
        /<source[^>]*src="(https:\/\/sex-studentki\.live\/[^"]+)"/i,
      ) ||
      this.matchSingle(playerBlock, /<source[^>]*src="([^"]+)"/i) ||
      ''
    );
  }

  private toAbsoluteUrl(value: string, base: string): string {
    if (!value) {
      return '';
    }

    try {
      return new URL(value, base).toString();
    } catch {
      return '';
    }
  }

  private normalizeUrl(input: string): string {
    const url = new URL(input);
    url.hash = '';
    return url.toString();
  }

  private matchSingle(input: string, regex: RegExp): string | null {
    const match = input.match(regex);
    if (!match) {
      return null;
    }

    if (match[1] !== undefined) {
      return match[1];
    }

    return match[0];
  }

  private cleanText(input: string): string {
    return this.decodeHtmlEntities(input.replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
  }

  private decodeHtmlEntities(input: string): string {
    return input
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
}
