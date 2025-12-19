import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { VideoAsset } from 'src/videoAssets/videoAsset.entity';
import { VideoAssetsType } from 'src/videoAssets/enums/videoAssets-type.enum';
import { VideoAssetsStatus } from 'src/videoAssets/enums/videoAssets-status.enum';
import {
  generateOutputOptions,
  splitVarStreamMapOption,
  generateResolutionIndexMap,
} from './utils/generateOutputOptions';

@Injectable()
export class VideoConverterService {
  private readonly logger = new Logger(VideoConverterService.name);

  constructor(
    @InjectRepository(VideoAsset)
    private videoAssetsRepository: Repository<VideoAsset>,
    private dataSource: DataSource,
  ) {
    // Устанавливаем путь к FFmpeg, если он не найден автоматически
    // На macOS с Homebrew обычно находится в /opt/homebrew/bin/ffmpeg
    try {
      const ffmpegPath = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
      const ffprobePath =
        process.env.FFPROBE_PATH || '/opt/homebrew/bin/ffprobe';

      // Проверяем существование файлов перед установкой пути
      if (fsSync.existsSync(ffmpegPath)) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        this.logger.log(`FFmpeg path set to: ${ffmpegPath}`);
      }
      if (fsSync.existsSync(ffprobePath)) {
        ffmpeg.setFfprobePath(ffprobePath);
        this.logger.log(`FFprobe path set to: ${ffprobePath}`);
      }
    } catch {
      this.logger.warn('Could not set FFmpeg paths, using system PATH');
    }
  }

  async convertToHLS(
    videoId: number,
    sourceFilePath: string,
    sourceAssetId: number,
  ): Promise<void> {
    // Структура: uploads/videos/{videoId}/hls/
    const videoDir = path.dirname(path.dirname(sourceFilePath)); // uploads/videos/{videoId}
    const hlsDir = path.join(videoDir, 'hls');
    // Сегменты будут храниться в папках по разрешениям: hls/{resolution}/segments/

    try {
      // Создаем базовую директорию для HLS файлов
      await fs.mkdir(hlsDir, { recursive: true });

      // Путь к master.m3u8
      const masterPlaylistPath = path.join(hlsDir, 'master.m3u8');

      // Конвертируем видео в HLS с несколькими битрейтами
      await this.convertVideoToHLS(sourceFilePath, hlsDir);

      // Проверяем, что master.m3u8 создан
      await fs.access(masterPlaylistPath);

      // Получаем размер master.m3u8
      const stats = await fs.stat(masterPlaylistPath);
      const mimeType = 'application/vnd.apple.mpegurl';

      // Создаем или обновляем VideoAsset с типом HLS_MASTER
      // Из-за ограничения OneToOne на video_id можем иметь только один ассет на видео
      // Поэтому проверяем существование и обновляем или создаем соответственно
      await this.dataSource.transaction(async (manager) => {
        // Проверяем, есть ли уже какой-либо VideoAsset для этого видео
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const existingAsset = await manager.query(
          `
          SELECT id, type FROM video_asset 
          WHERE video_id = $1
          `,
          [videoId],
        );

        if (
          Array.isArray(existingAsset) &&
          existingAsset.length > 0 &&
          existingAsset[0] &&
          typeof existingAsset[0] === 'object' &&
          'id' in existingAsset[0]
        ) {
          const asset = existingAsset[0] as { id: number; type: string };

          // Если это уже HLS_MASTER, обновляем его
          if (asset.type === (VideoAssetsType.HLS_MASTER as string)) {
            await manager.query(
              `
              UPDATE video_asset 
              SET status = $1, file_path = $2, mime_type = $3, size_bytes = $4, error = NULL
              WHERE id = $5
              `,
              [
                VideoAssetsStatus.READY,
                masterPlaylistPath,
                mimeType,
                stats.size,
                asset.id,
              ],
            );
          } else {
            // Если это SOURCE, обновляем его на HLS_MASTER
            // (так как OneToOne не позволяет иметь оба ассета одновременно)
            await manager.query(
              `
              UPDATE video_asset 
              SET type = $1, status = $2, file_path = $3, mime_type = $4, size_bytes = $5, error = NULL
              WHERE id = $6
              `,
              [
                VideoAssetsType.HLS_MASTER,
                VideoAssetsStatus.READY,
                masterPlaylistPath,
                mimeType,
                stats.size,
                asset.id,
              ],
            );
          }
        } else {
          // Если ассета нет, создаем новый HLS_MASTER
          await manager.query(
            `
            INSERT INTO video_asset (video_id, type, status, file_path, mime_type, size_bytes, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            `,
            [
              videoId,
              VideoAssetsType.HLS_MASTER,
              VideoAssetsStatus.READY,
              masterPlaylistPath,
              mimeType,
              stats.size,
            ],
          );
        }

        // Обновляем статус исходного VideoAsset на READY
        await manager.update(
          VideoAsset,
          { id: sourceAssetId },
          { status: VideoAssetsStatus.READY },
        );
      });

      this.logger.log(`Successfully converted video ${videoId} to HLS format`);
    } catch (error) {
      this.logger.error(`Failed to convert video ${videoId} to HLS: ${error}`);

      // Обновляем статус на FAILED
      await this.videoAssetsRepository.update(
        { id: sourceAssetId },
        {
          status: VideoAssetsStatus.FAILED,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );

      throw error;
    }
  }

  private async convertVideoToHLS(
    sourceFilePath: string,
    hlsDir: string,
  ): Promise<void> {
    // Генерируем маппинг индексов на названия разрешений из SUPPORTED_RESOLUTIONS
    const resolutionIndexMap = generateResolutionIndexMap();

    // Создаем папки для каждого разрешения перед запуском FFmpeg
    for (const resolutionName of resolutionIndexMap.values()) {
      const resolutionDir = path.join(hlsDir, resolutionName);
      const resolutionSegmentsDir = path.join(resolutionDir, 'segments');
      await fs.mkdir(resolutionSegmentsDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg(sourceFilePath);

      // Генерируем опции FFmpeg с учетом структуры папок по разрешениям
      const outputOptions = generateOutputOptions(hlsDir, resolutionIndexMap);
      const { optionsWithoutVarStreamMap, varStreamMapValue } =
        splitVarStreamMapOption(outputOptions);

      command
        .outputOptions(optionsWithoutVarStreamMap)
        .outputOption('-var_stream_map', varStreamMapValue)
        .output(path.join(hlsDir, '%v.m3u8'))
        .on('start', (commandLine: string) => {
          this.logger.log(`FFmpeg started: ${commandLine}`);
          const resolutionsList = Array.from(resolutionIndexMap.values()).join(
            ', ',
          );
          this.logger.log(`Converting to resolutions: ${resolutionsList}`);
        })
        .on('progress', (progress: { percent?: number }) => {
          const percent = progress.percent || 0;
          this.logger.log(`Processing: ${Math.round(percent)}% done`);
        })
        .on('end', () => {
          this.logger.log('FFmpeg conversion finished');
          resolve();
        })
        .on('error', (err: Error) => {
          this.logger.error(`FFmpeg error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }
}
