import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoAsset } from './videoAsset.entity';
import { VideoAssetsController } from './videoAssets.controller';
import { VideoAssetsService } from './videoAssets.service';

@Module({
  imports: [TypeOrmModule.forFeature([VideoAsset])],
  controllers: [VideoAssetsController],
  providers: [VideoAssetsService],
})
export class VideoAssetsModule {}
