import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoAsset } from 'src/videoAssets/videoAsset.entity';
import { VideoConverterService } from './video-converter.service';

@Module({
  imports: [TypeOrmModule.forFeature([VideoAsset])],
  providers: [VideoConverterService],
  exports: [VideoConverterService],
})
export class VideoConverterModule {}
