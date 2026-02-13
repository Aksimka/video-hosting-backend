import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { VideoAsset } from './videoAsset.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class VideoAssetsService {
  constructor(
    @InjectRepository(VideoAsset)
    private videoAssetsRepository: Repository<VideoAsset>,
  ) {}

  /** Возвращает все video assets без фильтрации. */
  findAll(): Promise<VideoAsset[]> {
    return this.videoAssetsRepository.find();
  }

  /** Возвращает один video asset по id. */
  findOne(id: number): Promise<VideoAsset | null> {
    return this.videoAssetsRepository.findOneBy({ id });
  }

  /** Удаляет video asset по id. */
  async remove(id: number): Promise<void> {
    await this.videoAssetsRepository.delete(id);
  }
}
