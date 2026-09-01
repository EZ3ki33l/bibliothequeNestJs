import { IsNotEmpty, IsString } from 'class-validator';

export class StartQuizDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;
}
