import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Video } from './video.entity';
import { VideoAsset } from 'src/videoAssets/videoAsset.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { VideoConverterService } from 'src/video-converter/video-converter.service';
import { VideoStatus } from './enums/video-status.enum';
import { VideoVisibility } from './enums/video-visibility.enum';
import { VideoAssetsType } from 'src/videoAssets/enums/videoAssets-type.enum';
import { VideoAssetsStatus } from 'src/videoAssets/enums/videoAssets-status.enum';
import { VideoConverterResolution } from 'src/video-converter/enums/video-converter-resolution.enum';

export interface StreamRange {
  start: number;
  end: number;
  chunkSize: number;
}

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
    if (!fs.existsSync(filePath)) {
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
    const stats = fs.statSync(filePath);
    const actualFileSize = stats.size;

    const streamInfo: StreamInfo = {
      filePath,
      mimeType,
      fileSize: actualFileSize,
    };

    // Если Range заголовок присутствует, парсим его
    if (rangeHeader) {
      const range = this.parseRangeHeader(rangeHeader, actualFileSize);
      if (range) {
        streamInfo.range = range;
      }
    }

    return streamInfo;
  }

  private parseRangeHeader(
    rangeHeader: string,
    fileSize: number,
  ): StreamRange | null {
    // Парсим Range: bytes=start-end или bytes=start-
    const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!rangeMatch) {
      throw new HttpException(
        'Invalid Range header',
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );
    }

    const start = parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

    // Валидация границ
    if (
      isNaN(start) ||
      isNaN(end) ||
      start < 0 ||
      end >= fileSize ||
      start > end
    ) {
      throw new HttpException(
        'Range Not Satisfiable',
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );
    }

    // Вычисляем размер чанка
    const chunkSize = end - start + 1;

    return {
      start,
      end,
      chunkSize,
    };
  }

  private parseRangeHeaderSoft(
    rangeHeader: string,
    fileSize: number,
  ): StreamRange | null {
    // Мягкий парсинг Range для HLS (не выбрасывает исключения)
    const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!rangeMatch) {
      return null;
    }

    const start = parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

    // Валидация границ (возвращаем null при ошибке вместо исключения)
    if (
      isNaN(start) ||
      isNaN(end) ||
      start < 0 ||
      end >= fileSize ||
      start > end
    ) {
      return null;
    }

    // Вычисляем размер чанка
    const chunkSize = end - start + 1;

    return {
      start,
      end,
      chunkSize,
    };
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

    // Определяем путь к запрашиваемому файлу
    const masterPlaylistDir = path.dirname(assetObj.file_path);
    let filePath: string;

    // Извлекаем имя файла из запроса
    const fileName = fileRequest.split('/').pop() || fileRequest;

    if (fileName === 'master.m3u8' || fileRequest.includes('master.m3u8')) {
      // Запрос master.m3u8
      filePath = assetObj.file_path;
    } else if (fileName.endsWith('.m3u8')) {
      // Запрос конкретного плейлиста
      // FFmpeg создает плейлисты как 0.m3u8, 1.m3u8 в корне hls
      // Ищем плейлист в корне hls (независимо от разрешения)
      filePath = path.join(masterPlaylistDir, fileName);
    } else if (fileName.endsWith('.ts')) {
      // Запрос сегмента .ts
      // Сегменты хранятся в папках по разрешениям: hls/{resolution}/segments/
      let resolutionName: string | undefined;

      if (resolution) {
        // Если разрешение указано в URL, используем его
        resolutionName = resolution;
      } else {
        // Если разрешение не указано, используем 360p по умолчанию
        resolutionName = VideoConverterResolution.RESOLUTION_360P;
      }

      if (!resolutionName) {
        throw new NotFoundException(
          'HLS file not found: resolution not determined',
        );
      }

      const segmentsDir = path.join(
        masterPlaylistDir,
        resolutionName,
        'segments',
      );
      filePath = path.join(segmentsDir, fileName);
    } else {
      // По умолчанию возвращаем master.m3u8
      filePath = assetObj.file_path;
    }

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('HLS file not found');
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Определяем MIME тип
    const mimeType = filePath.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : 'video/mp2t';

    const hlsStreamInfo: HLSStreamInfo = {
      filePath,
      mimeType,
      fileSize,
    };

    // Для .ts файлов парсим Range заголовок (мягкая валидация)
    if (rangeHeader && filePath.endsWith('.ts')) {
      const range = this.parseRangeHeaderSoft(rangeHeader, fileSize);
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
            console.error(
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
            console.error('Failed to delete file after error:', deleteError);
          }
        }
        throw error;
      }
    });
  }
}
