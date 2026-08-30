import { IsUUID } from 'class-validator';

export class EnsureReviewDto {
  @IsUUID()
  entryId!: string;
}
