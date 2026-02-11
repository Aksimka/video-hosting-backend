import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ParsedVideo } from 'src/video-parser/entities/parsed-video.entity';
import { ParserVideoSite } from 'src/video-parser/enums/parser-video-site.enum';
import { PublishedVideoStatus } from './enums/published-video-status.enum';

@Entity({ name: 'published_videos' })
@Index(['parsed_video_id'], { unique: true })
@Index(['status', 'updated_at'])
export class PublishedVideo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  parsed_video_id: number;

  @ManyToOne(() => ParsedVideo, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parsed_video_id' })
  parsed_video: ParsedVideo;

  @Column({ enum: ParserVideoSite })
  site: ParserVideoSite;

  @Column({ type: 'text' })
  page_url: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', nullable: true })
  duration_seconds: number | null;

  @Column({ type: 'text' })
  player_source_url: string;

  @Column({ type: 'text', nullable: true })
  direct_video_url: string | null;

  @Column({ type: 'timestamp', nullable: true })
  direct_video_expires_at: Date | null;

  @Column({ type: 'text', nullable: true })
  thumbnail_url: string | null;

  @Column({ type: 'text', nullable: true })
  poster_url: string | null;

  @Column({ type: 'text', nullable: true })
  trailer_mp4_url: string | null;

  @Column({ type: 'text', nullable: true })
  trailer_webm_url: string | null;

  @Column({ type: 'text', nullable: true })
  timeline_sprite_template_url: string | null;

  @Column({
    enum: PublishedVideoStatus,
    default: PublishedVideoStatus.PUBLISHED,
  })
  status: PublishedVideoStatus;

  @Column({ type: 'timestamp', nullable: true })
  published_at: Date | null;

  @Column({ type: 'integer', nullable: true })
  published_by: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
