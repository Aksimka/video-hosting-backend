import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Video } from './video.entity';
import { VideoAsset } from 'src/videoAssets/videoAsset.entity';
import { CreateVideoDto } from './dto/create-video.dto';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { VideoStatus } from './enums/video-status.enum';
import { VideoVisibility } from './enums/video-visibility.enum';
import { VideoAssetsType } from 'src/videoAssets/enums/videoAssets-type.enum';
import { VideoAssetsStatus } from 'src/videoAssets/enums/videoAssets-status.enum';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private videosRepository: Repository<Video>,
    @InjectRepository(VideoAsset)
    private videoAssetsRepository: Repository<VideoAsset>,
    private fileStorageService: FileStorageService,
    private dataSource: DataSource,
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

  async createVideoWithAsset(
    file: Express.Multer.File,
    createVideoDto: CreateVideoDto,
  ): Promise<Video | null> {
    let savedFilePath: string | null = null;

    return await this.dataSource.transaction(async (manager) => {
      try {
        // 1. Сохранить файл
        const saveResult = await this.fileStorageService.saveFile(
          file,
          'videos',
        );
        savedFilePath = saveResult.path;

        // 2. Создать Video
        const video = manager.create(Video, {
          title: createVideoDto.title,
          description: createVideoDto.description,
          visibility: createVideoDto.visibility ?? VideoVisibility.PUBLIC,
          status: VideoStatus.UPLOADING,
          owner_id: createVideoDto.owner_id,
        });

        const savedVideo = await manager.save(Video, video);

        // 3. Создать VideoAsset
        const videoAsset = manager.create(VideoAsset, {
          video_id: savedVideo.id,
          type: VideoAssetsType.SOURCE,
          status: VideoAssetsStatus.PROCESSING,
          file_path: saveResult.path,
          mime_type: saveResult.mimeType,
          size_bytes: saveResult.size,
        });

        await manager.save(VideoAsset, videoAsset);

        // 4. Вернуть Video с загруженным video_asset
        const videoRepository = manager.getRepository(Video);
        return await videoRepository.findOne({
          where: { id: savedVideo.id },
          relations: ['video_asset'],
        });
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
