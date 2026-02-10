import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ParserVideoSite } from '../enums/parser-video-site.enum';
import { ParserTag } from './parser-tag.entity';

@Entity({ name: 'parsed_video_tags' })
@Index(['site', 'video_external_key', 'tag_id'], { unique: true })
@Index(['site', 'video_external_key'])
export class ParserVideoTag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ enum: ParserVideoSite })
  site: ParserVideoSite;

  @Column({ type: 'varchar', length: 512 })
  video_external_key: string;

  @Column()
  tag_id: number;

  @ManyToOne(() => ParserTag, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tag_id' })
  tag: ParserTag;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
