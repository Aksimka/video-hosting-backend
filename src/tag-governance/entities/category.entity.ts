import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CategoryMatchMode } from '../enums/category-match-mode.enum';

@Entity({ name: 'categories' })
@Index(['slug'], { unique: true })
@Index(['is_active'])
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 256 })
  name: string;

  @Column({ type: 'varchar', length: 256 })
  slug: string;

  @Column({ enum: CategoryMatchMode, default: CategoryMatchMode.ANY })
  match_mode: CategoryMatchMode;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
