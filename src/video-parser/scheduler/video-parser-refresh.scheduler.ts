import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { VideoParserService } from '../video-parser.service';

@Injectable()
export class VideoParserRefreshScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(VideoParserRefreshScheduler.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private readonly videoParserService: VideoParserService) {}

  onModuleInit(): void {
    const intervalMs = this.getIntervalMs();
    this.intervalId = setInterval(() => {
      this.tick().catch((error: unknown) => {
        this.logger.error(`Periodic parser refresh failed: ${String(error)}`);
      });
    }, intervalMs);

    this.logger.log(
      `Periodic parser refresh started with interval ${intervalMs}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    const result = await this.videoParserService.refreshExpiringSourcesBatch();
    if (result && result.checked > 0) {
      this.logger.log(
        `Periodic refresh checked=${result.checked} refreshed=${result.refreshed} failed=${result.failed}`,
      );
    }
  }

  private getIntervalMs(): number {
    const raw = parseInt(
      process.env.PARSER_REFRESH_INTERVAL_MS || '300000',
      10,
    );
    if (Number.isNaN(raw)) {
      return 300_000;
    }

    return Math.max(30_000, raw);
  }
}
