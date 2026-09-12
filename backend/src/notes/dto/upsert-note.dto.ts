import { IsString, MaxLength } from 'class-validator';

export class UpsertNoteDto {
  @IsString()
  @MaxLength(4000)
  content!: string;
}
