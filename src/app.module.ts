import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VideosModule } from './videos/videos.module';
import { VideoAssetsModule } from './videoAssets/videoAssets.module';
import { VideoProxyModule } from './video-proxy/video-proxy.module';
import { VideoParserModule } from './video-parser/video-parser.module';
import { databaseConfig } from './database/database.config';
import { tagsDatabaseConfig } from './database/tags-database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    VideosModule,
    VideoAssetsModule,
    VideoProxyModule,
    VideoParserModule,
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forRoot(tagsDatabaseConfig),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor(private dataSource: DataSource) {}
}
