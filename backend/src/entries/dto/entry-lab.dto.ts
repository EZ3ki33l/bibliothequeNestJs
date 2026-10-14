import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsLabFiles } from '../../common/lab-files';
import { LabHost, LabTool } from '../../generated/prisma/enums';

/**
 * Laboratoire d'une fiche, imbriqué dans `POST`/`PATCH /admin/entries`
 * (`@ValidateNested` + `@Type` côté DTO parent, sinon rien n'est validé).
 */
export class EntryLabDto {
  @IsEnum(LabTool)
  tool!: LabTool;

  @IsBoolean()
  securityLab!: boolean;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  software!: string;

  @IsInt()
  @Min(1)
  @Max(128)
  ramGb!: number;

  @IsInt()
  @Min(1)
  @Max(500)
  diskGb!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(LabHost, { each: true })
  hosts!: LabHost[];

  @IsString()
  @MaxLength(5000)
  setupMd!: string;

  @IsString()
  @MaxLength(3000)
  teardownMd!: string;

  @IsLabFiles()
  files!: Record<string, string>;
}
