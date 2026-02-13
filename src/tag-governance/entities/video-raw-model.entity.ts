import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ParserVideoSite } from 'src/video-parser/enums/parser-video-site.enum';
import { RawModel } from './raw-model.entity';

@Entity({ name: 'video_raw_models' })
@Index(['site', 'video_external_key', 'raw_model_id'], { unique: true })
@Index(['site', 'video_external_key'])
export class VideoRawModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ enum: ParserVideoSite })
  site: ParserVideoSite;

  @Column({ type: 'varchar', length: 512 })
  video_external_key: string;

  @Column()
  raw_model_id: number;

  @ManyToOne(() => RawModel, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'raw_model_id' })
  raw_model: RawModel;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
