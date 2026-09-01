import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuizAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  choiceIndex!: number;
}

export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers!: QuizAnswerDto[];
}
