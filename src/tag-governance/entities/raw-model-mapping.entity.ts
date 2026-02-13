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
import { RawModel } from './raw-model.entity';
import { CanonicalModel } from './canonical-model.entity';
import { RawTagMappingStatus } from '../enums/raw-tag-mapping-status.enum';

@Entity({ name: 'raw_model_mappings' })
@Index(['raw_model_id'], { unique: true })
@Index(['status'])
@Index(['canonical_model_id'])
export class RawModelMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  raw_model_id: number;

  @ManyToOne(() => RawModel, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'raw_model_id' })
  raw_model: RawModel;

  @Column({ nullable: true })
  canonical_model_id: number | null;

  @ManyToOne(() => CanonicalModel, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'canonical_model_id' })
  canonical_model: CanonicalModel | null;

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
