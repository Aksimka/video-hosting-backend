import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { VideoAssetsType } from './enums/videoAssets-type.enum';
import { VideoAssetsStatus } from './enums/videoAssets-status.enum';
import { Video } from 'src/videos/video.entity';

@Entity()
export class VideoAsset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  video_id: number;

  @OneToOne(() => Video, (video) => video.video_asset)
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({ enum: VideoAssetsType, default: VideoAssetsType.SOURCE })
  type: VideoAssetsType;

  @Column({ nullable: true, default: VideoAssetsStatus.PROCESSING })
  status: VideoAssetsStatus;

  @Column({ nullable: true })
  error: string;

  @Column({ nullable: true })
  file_path: string;

  @Column({ default: 'video/mp4' })
  mime_type: string;

  @Column()
  size_bytes: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
