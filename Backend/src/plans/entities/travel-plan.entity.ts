import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('travel_plans')
export class TravelPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.travelPlans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ default: 'Mi viaje' })
  title: string;

  @Column({ name: 'budget_amount', type: 'decimal', precision: 14, scale: 2 })
  budgetAmount: string;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ name: 'origin_city_code', type: 'varchar', length: 16, nullable: true })
  originCityCode: string | null;

  @Column({ name: 'origin_city_name', type: 'varchar', length: 255, nullable: true })
  originCityName: string | null;

  @Column({ name: 'destination_city_code', type: 'varchar', length: 16, nullable: true })
  destinationCityCode: string | null;

  @Column({ name: 'destination_city_name', type: 'varchar', length: 255, nullable: true })
  destinationCityName: string | null;

  @Column({ name: 'departure_date', type: 'date', nullable: true })
  departureDate: string | null;

  @Column({ name: 'return_date', type: 'date', nullable: true })
  returnDate: string | null;

  @Column({ name: 'recommendations_json', type: 'jsonb', nullable: true })
  recommendationsJson: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
