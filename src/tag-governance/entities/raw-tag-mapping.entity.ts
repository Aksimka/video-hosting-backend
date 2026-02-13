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
import { ParserTag } from 'src/video-parser/entities/parser-tag.entity';
import { CanonicalTag } from './canonical-tag.entity';
import { RawTagMappingStatus } from '../enums/raw-tag-mapping-status.enum';

@Entity({ name: 'raw_tag_mappings' })
@Index(['raw_tag_id'], { unique: true })
@Index(['status'])
@Index(['canonical_tag_id'])
export class RawTagMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  raw_tag_id: number;

  @ManyToOne(() => ParserTag, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'raw_tag_id' })
  raw_tag: ParserTag;

  @Column({ nullable: true })
  canonical_tag_id: number | null;

  @ManyToOne(() => CanonicalTag, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'canonical_tag_id' })
  canonical_tag: CanonicalTag | null;

  @Column({ enum: RawTagMappingStatus, default: RawTagMappingStatus.UNMAPPED })
  status: RawTagMappingStatus;

  @Column({ type: 'integer', nullable: true })
  mapped_by: number | null;

  @Column({ type: 'timestamp', nullable: true })
  mapped_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
