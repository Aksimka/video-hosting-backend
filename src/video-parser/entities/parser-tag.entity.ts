import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ParserVideoSite } from '../enums/parser-video-site.enum';
import { ParserTagType } from '../enums/parser-tag-type.enum';

@Entity({ name: 'parsed_tags' })
@Index(['site', 'slug', 'type'], { unique: true })
@Index(['site', 'name', 'type'])
export class ParserTag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ enum: ParserVideoSite })
  site: ParserVideoSite;

  @Column({ type: 'varchar', length: 256 })
  slug: string;

  @Column({ type: 'varchar', length: 256 })
  name: string;

  @Column({ enum: ParserTagType })
  type: ParserTagType;

  @Column({ type: 'varchar', length: 128, nullable: true })
  group_label: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
