import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { CanonicalTag } from './canonical-tag.entity';

@Entity({ name: 'category_canonical_tags' })
@Index(['category_id', 'canonical_tag_id'], { unique: true })
@Index(['canonical_tag_id'])
export class CategoryCanonicalTag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  category_id: number;

  @ManyToOne(() => Category, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column()
  canonical_tag_id: number;

  @ManyToOne(() => CanonicalTag, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'canonical_tag_id' })
  canonical_tag: CanonicalTag;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
