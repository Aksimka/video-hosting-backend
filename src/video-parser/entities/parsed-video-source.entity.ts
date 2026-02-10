import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ParserVideoSourceType } from '../enums/parser-video-source-type.enum';
import { ParserSourceStatus } from '../enums/parser-source-status.enum';
import { ParsedVideo } from './parsed-video.entity';

@Entity({ name: 'parsed_video_sources' })
@Index(['parsed_video_id', 'type'], { unique: true })
@Index(['type', 'expires_at'])
export class ParsedVideoSource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  parsed_video_id: number;

  @ManyToOne(() => ParsedVideo, (video) => video.sources, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parsed_video_id' })
  parsed_video: ParsedVideo;

  @Column({ enum: ParserVideoSourceType })
  type: ParserVideoSourceType;

  @Column({ type: 'text' })
  url: string;

  @Column({ enum: ParserSourceStatus, default: ParserSourceStatus.ACTIVE })
  status: ParserSourceStatus;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  last_checked_at: Date | null;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
