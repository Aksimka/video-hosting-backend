import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ParserVideoSite } from 'src/video-parser/enums/parser-video-site.enum';

@Entity({ name: 'raw_models' })
@Index(['site', 'slug'], { unique: true })
@Index(['site', 'normalized_name'])
export class RawModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ enum: ParserVideoSite })
  site: ParserVideoSite;

  @Column({ type: 'varchar', length: 256 })
  slug: string;

  @Column({ type: 'varchar', length: 256 })
  name: string;

  @Column({ type: 'varchar', length: 256 })
  normalized_name: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
