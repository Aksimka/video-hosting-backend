import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Video } from './video.entity';
import { VideoAsset } from 'src/videoAssets/videoAsset.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { VideoConverterService } from 'src/video-converter/video-converter.service';
import { VideoStatus } from './enums/video-status.enum';
import { VideoVisibility } from './enums/video-visibility.enum';
import { VideoAssetsType } from 'src/videoAssets/enums/videoAssets-type.enum';
import { VideoAssetsStatus } from 'src/videoAssets/enums/videoAssets-status.enum';
import {
  parseRangeHeader,
  parseRangeHeaderSoft,
  type StreamRange,
} from './utils/range-parser.util';
import { resolveHLSPath } from './utils/hls-path.util';
import {
  fileExistsSync,
  getFileStatsSync,
} from 'src/common/utils/file-system.util';
import { getHLSMimeType } from 'src/common/utils/mime-type.util';
import * as fs from 'fs';

export type { StreamRange } from './utils/range-parser.util';

export interface StreamInfo {
  filePath: string;
  mimeType: string;
  fileSize: number;
  range?: StreamRange;
}

export interface HLSStreamInfo {
  filePath: string;
  mimeType: string;
  fileSize: number;
  range?: StreamRange;
}

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    @InjectRepository(Video)
    private videosRepository: Repository<Video>,
    @InjectRepository(VideoAsset)
    private videoAssetsRepository: Repository<VideoAsset>,
    private fileStorageService: FileStorageService,
    private dataSource: DataSource,
    private videoConverterService: VideoConverterService,
  ) {}

  findAll(): Promise<Video[]> {
    return this.videosRepository.find();
  }

  findOne(id: number): Promise<Video | null> {
    return this.videosRepository.findOneBy({ id });
  }

  async remove(id: number): Promise<void> {
    await this.videosRepository.delete(id);
  }

  async getVideoStreamInfo(id: number): Promise<VideoAsset> {
    const video = await this.videosRepository.findOne({
      where: { id },
      relations: ['video_asset'],
    });

    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    if (!video.video_asset) {
      throw new NotFoundException(`Video asset for video ID ${id} not found`);
    }

    if (!video.video_asset.file_path) {
      throw new NotFoundException(
        `File path for video asset ID ${video.video_asset.id} not found`,
      );
    }

    return video.video_asset;
  }

  async getHLSVideoAsset(videoId: number): Promise<VideoAsset | null> {
    const hlsAsset = await this.videoAssetsRepository.findOne({
      where: {
        video_id: videoId,
        type: VideoAssetsType.HLS_MASTER,
      },
    });

    return hlsAsset;
  }

  async getStreamInfo(
    videoId: number,
    rangeHeader?: string,
  ): Promise<StreamInfo> {
    // Сначала проверяем наличие HLS версии
    const hlsAsset = await this.getHLSVideoAsset(videoId);
    const videoAsset = hlsAsset || (await this.getVideoStreamInfo(videoId));

    const assetObj = videoAsset as unknown as {
      file_path: string;
      mime_type: string;
      type: VideoAssetsType;
    };

    const filePath = assetObj.file_path;
    if (!filePath) {
      throw new HttpException('Video file not found', HttpStatus.NOT_FOUND);
    }

    // Проверяем существование файла
    if (!fileExistsSync(filePath)) {
      throw new HttpException('Video file not found', HttpStatus.NOT_FOUND);
    }

    // Определяем MIME тип в зависимости от типа ассета
    let mimeType = assetObj.mime_type;
    if (assetObj.type === VideoAssetsType.HLS_MASTER) {
      mimeType = 'application/vnd.apple.mpegurl';
    } else {
      mimeType = mimeType || 'video/mp4';
    }

    // Получаем статистику файла для проверки размера
    const stats = getFileStatsSync(filePath);
    const actualFileSize = stats.size;

    const streamInfo: StreamInfo = {
      filePath,
      mimeType,
      fileSize: actualFileSize,
    };

    // Если Range заголовок присутствует, парсим его
    if (rangeHeader) {
      const range = parseRangeHeader(rangeHeader, actualFileSize);
      if (range) {
        streamInfo.range = range;
      }
    }

    return streamInfo;
  }

  createFileStream(
    filePath: string,
    start?: number,
    end?: number,
  ): fs.ReadStream {
    if (start !== undefined && end !== undefined) {
      return fs.createReadStream(filePath, { start, end });
    }
    return fs.createReadStream(filePath);
  }

  async getHLSStreamInfo(
    videoId: number,
    fileRequest: string,
    rangeHeader?: string,
    resolution?: string,
  ): Promise<HLSStreamInfo> {
    const hlsAsset = await this.getHLSVideoAsset(videoId);

    if (!hlsAsset) {
      throw new NotFoundException('HLS stream not found');
    }

    const assetObj = hlsAsset as unknown as {
      file_path: string;
    };

    if (!assetObj.file_path) {
      throw new NotFoundException('HLS stream not found');
    }

    // Определяем путь к запрашиваемому файлу используя утилиту
    const filePath = resolveHLSPath(
      assetObj.file_path,
      fileRequest,
      resolution,
    );

    // Проверяем существование файла
    if (!fileExistsSync(filePath)) {
      throw new NotFoundException('HLS file not found');
    }

    const stats = getFileStatsSync(filePath);
    const fileSize = stats.size;

    // Определяем MIME тип
    const mimeType = getHLSMimeType(filePath);

    const hlsStreamInfo: HLSStreamInfo = {
      filePath,
      mimeType,
      fileSize,
    };

    // Для .ts файлов парсим Range заголовок (мягкая валидация)
    if (rangeHeader && filePath.endsWith('.ts')) {
      const range = parseRangeHeaderSoft(rangeHeader, fileSize);
      if (range) {
        hlsStreamInfo.range = range;
      }
    }

    return hlsStreamInfo;
  }

  async getStreamRequestInfo(
    videoId: number,
    url: string,
    queryFile?: string,
  ): Promise<{ isHLS: boolean; fileRequest?: string }> {
    const hlsAsset = await this.getHLSVideoAsset(videoId);

    if (!hlsAsset) {
      return { isHLS: false };
    }

    // Определяем запрашиваемый файл или используем master.m3u8 по умолчанию
    let fileRequest = 'master.m3u8'; // По умолчанию master.m3u8

    if (queryFile) {
      // Если указан файл в query параметре
      fileRequest = queryFile;
    } else if (url.includes('.m3u8') || url.includes('.ts')) {
      // Если файл указан в URL
      fileRequest = url.split('/').pop() || 'master.m3u8';
    }

    return { isHLS: true, fileRequest };
  }

  async createVideoWithAsset(
    file: Express.Multer.File,
    createVideoDto: CreateVideoDto,
  ): Promise<Video | null> {
    let savedFilePath: string | null = null;

    return await this.dataSource.transaction(async (manager) => {
      try {
        // 1. Создать Video (нужен ID для структуры папок)
        const video = manager.create(Video, {
          title: createVideoDto.title,
          description: createVideoDto.description,
          visibility: createVideoDto.visibility ?? VideoVisibility.PUBLIC,
          status: VideoStatus.UPLOADING,
          owner_id: createVideoDto.owner_id,
        });

        const savedVideo = await manager.save(Video, video);

        // 2. Сохранить файл в структуру uploads/videos/{videoId}/source/
        const saveResult = await this.fileStorageService.saveFile(
          file,
          'videos',
          savedVideo.id,
        );
        savedFilePath = saveResult.path;

        // 3. Создать VideoAsset
        const videoAsset = manager.create(VideoAsset, {
          video_id: savedVideo.id,
          type: VideoAssetsType.SOURCE,
          status: VideoAssetsStatus.PROCESSING,
          file_path: saveResult.path,
          mime_type: saveResult.mimeType,
          size_bytes: saveResult.size,
        });

        const savedVideoAsset = await manager.save(VideoAsset, videoAsset);

        // 4. Вернуть Video с загруженным video_asset
        const videoRepository = manager.getRepository(Video);
        const result = await videoRepository.findOne({
          where: { id: savedVideo.id },
          relations: ['video_asset'],
        });

        // 5. Запускаем асинхронную конвертацию в HLS (не блокируем ответ)
        this.videoConverterService
          .convertToHLS(savedVideo.id, saveResult.path, savedVideoAsset.id)
          .catch((error) => {
            this.logger.error(
              `Failed to convert video ${savedVideo.id} to HLS:`,
              error,
            );
          });

        return result;
      } catch (error) {
        // При ошибке удаляем сохраненный файл
        if (savedFilePath) {
          try {
            await this.fileStorageService.deleteFile(savedFilePath);
          } catch (deleteError) {
            // Логируем ошибку удаления, но не прерываем процесс
            this.logger.error(
              'Failed to delete file after error:',
              deleteError,
            );
          }
        }
        throw error;
      }
    });
  }
}
