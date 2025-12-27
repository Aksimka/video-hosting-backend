import { Injectable, BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IVideoProxyStrategy } from './interfaces/video-proxy-strategy.interface';
import { VkVideoProxyStrategy } from './strategies/vk-video-proxy.strategy';

/**
 * Типы поддерживаемых сервисов для проксирования видео
 */
export enum VideoProxyServiceType {
  VK = 'vk',
  // В будущем можно добавить другие сервисы:
  // YOUTUBE = 'youtube',
  // VIMEO = 'vimeo',
  // и т.д.
}

@Injectable()
export class VideoProxyService {
  private readonly strategies: Map<VideoProxyServiceType, IVideoProxyStrategy>;

  constructor(private readonly vkStrategy: VkVideoProxyStrategy) {
    // Инициализируем стратегии
    this.strategies = new Map();
    this.strategies.set(VideoProxyServiceType.VK, vkStrategy);
  }

  /**
   * Получает стратегию для указанного типа сервиса
   */
  private getStrategy(serviceType: VideoProxyServiceType): IVideoProxyStrategy {
    const strategy = this.strategies.get(serviceType);
    if (!strategy) {
      throw new BadRequestException(
        `Unsupported video proxy service type: ${serviceType}`,
      );
    }
    return strategy;
  }

  /**
   * Получает тип сервиса по ID видео из БД
   * TODO: Реализовать получение из БД, пока возвращает VK как заглушку
   * @param videoId - ID видео
   * @returns Тип сервиса
   */
  getServiceTypeByVideoId(videoId: string): Promise<VideoProxyServiceType> {
    // TODO: Получить тип сервиса из БД по videoId
    // Пример: const video = await this.videoRepository.findOne({ where: { id: videoId } });
    // return video.proxy_service_type;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ignored = videoId;

    // Временная заглушка - всегда возвращаем VK
    return Promise.resolve(VideoProxyServiceType.VK);
  }

  /**
   * Проксирует видео запрос на внешний сервис
   * @param videoId - ID видео
   * @param req - Express Request объект
   * @param res - Express Response объект
   */
  async proxyVideo(
    videoId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const serviceType = await this.getServiceTypeByVideoId(videoId);
    const strategy = this.getStrategy(serviceType);
    await strategy.proxyVideo(req, res, { id: videoId });
  }
}
