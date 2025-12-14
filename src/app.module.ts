import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Video } from './videos/video.entity';
import { DataSource } from 'typeorm';
import { VideosModule } from './videos/videos.module';
import { VideoAssetsModule } from './videoAssets/videoAssets.module';
import { VideoAsset } from './videoAssets/videoAsset.entity';

@Module({
  imports: [
    VideosModule,
    VideoAssetsModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'postgres',
      entities: [Video, VideoAsset],
      synchronize: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor(private dataSource: DataSource) {}
}
