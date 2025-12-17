import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Video } from '../videos/video.entity';
import { VideoAsset } from '../videoAssets/videoAsset.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'postgres',
  entities: [Video, VideoAsset],
  synchronize: process.env.DB_SYNCHRONIZE === 'true' || true,
};

