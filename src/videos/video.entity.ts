import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';
import { VideoVisibility } from './enums/video-visibility.enum';
import { VideoStatus } from './enums/video-status.enum';
import { VideoAsset } from 'src/videoAssets/videoAsset.entity';

@Entity()
export class Video {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: VideoVisibility.PUBLIC })
  visibility: VideoVisibility;

  @Column({ default: VideoStatus.UPLOADING })
  status: VideoStatus;

  @Column()
  owner_id: number;

  @Column({ nullable: true })
  poster_asset_id: string;

  @Column({ nullable: true })
  video_preview_asset_id: string;

  @Column({ nullable: true })
  duration: number;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: true,
  })
  created_at: Date | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  updated_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: true,
  })
  published_at: Date;

  @OneToOne(() => VideoAsset, (videoAsset: VideoAsset) => videoAsset.video)
  video_asset: VideoAsset;
}
