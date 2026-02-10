import {
  ParsedCategoryResult,
  ParsedVideoData,
} from './parsed-video-data.interface';

/**
 * Интерфейс стратегии парсинга видео-площадок.
 * Все стратегии могут отличаться реализацией, но возвращают единый формат данных.
 */
export interface IVideoParserStrategy {
  canHandleUrl(url: string): boolean;
  parseCategory(categoryUrl: string): Promise<ParsedCategoryResult>;
  parseVideo(videoUrl: string): Promise<ParsedVideoData>;
}
