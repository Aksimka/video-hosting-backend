import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Video } from './video.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private videosRepository: Repository<Video>,
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
}
