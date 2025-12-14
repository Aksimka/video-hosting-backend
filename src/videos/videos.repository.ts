import { EntityRepository, Repository } from 'typeorm';
import { Video } from './video.entity';
import { DataSource } from 'typeorm';

@EntityRepository(Video)
export class VideosRepository extends Repository<Video> {
  constructor(private dataSource: DataSource) {
    super(Video, dataSource.createEntityManager());
  }
}
