import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ParserVideoSite } from '../enums/parser-video-site.enum';
import { ParsedVideoSource } from './parsed-video-source.entity';

@Entity({ name: 'parsed_videos' })
@Index(['site', 'page_url'], { unique: true })
@Index(['site', 'page_slug_id'])
@Index(['site', 'media_id'])
export class ParsedVideo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ enum: ParserVideoSite })
  site: ParserVideoSite;

  @Column({ type: 'text' })
  page_url: string;

  @Column({ type: 'text', nullable: true })
  category_url: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  page_slug_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  media_id: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'integer', nullable: true })
  duration_seconds: number | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

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

  @Column({ type: 'timestamp', nullable: true })
  direct_video_expires_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_checked_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_refreshed_at: Date | null;

  @Column({ default: false })
  needs_refresh: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => ParsedVideoSource, (source) => source.parsed_video)
  sources: ParsedVideoSource[];
}
