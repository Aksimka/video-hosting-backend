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

  findAll(): Promise<VideoAsset[]> {
    return this.videoAssetsRepository.find();
  }

  findOne(id: number): Promise<VideoAsset | null> {
    return this.videoAssetsRepository.findOneBy({ id });
  }

  async remove(id: number): Promise<void> {
    await this.videoAssetsRepository.delete(id);
  }
}
