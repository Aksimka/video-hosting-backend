import { Request, Response } from 'express';

/**
 * Интерфейс стратегии проксирования видео с внешнего сервиса
 */
export interface IVideoProxyStrategy {
  /**
   * Проксирует видео запрос на внешний сервис
   * @param req - Express Request объект
   * @param res - Express Response объект
   * @param params - Дополнительные параметры (например, ID видео)
   */
  proxyVideo(
    req: Request,
    res: Response,
    params: Record<string, string>,
  ): Promise<void>;
}
