import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListNotesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  entryId?: string;
}
