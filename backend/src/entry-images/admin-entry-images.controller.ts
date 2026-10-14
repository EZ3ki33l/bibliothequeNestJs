import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentAdminRole, CurrentUserId } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { MAX_UPLOAD_BYTES } from '../common/image-limits';
import type { AdminRole } from '../generated/prisma/enums';
import { UpdateEntryImageDto } from './dto/update-entry-image.dto';
import { UploadEntryImageDto } from './dto/upload-entry-image.dto';
import { EntryImagesService, type UploadedImageFile } from './entry-images.service';

export const FILE_TOO_LARGE = 'Le fichier dépasse 10 Mo.';
export const MALFORMED_UPLOAD = 'Envoi invalide : un seul fichier, dans le champ « file ».';

/** Messages de multer (en anglais) qui signalent un formulaire mal formé. */
const MULTER_MESSAGES =
  /^(Unexpected field|Too many (files|fields|parts)|Field (name|value) too long)/;

/**
 * Traduit les refus de multer en messages français : multer coupe le fichier
 * **pendant la lecture** dès qu'il dépasse la taille admise, et Nest en fait un
 * 413 au message anglais. Les autres erreurs passent telles quelles.
 */
@Catch(HttpException)
class UploadErrorsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const message = (exception.getResponse() as { message?: unknown }).message;

    if (exception instanceof PayloadTooLargeException) {
      response.status(status).json({ statusCode: status, message: FILE_TOO_LARGE });
      return;
    }
    if (
      exception instanceof BadRequestException &&
      typeof message === 'string' &&
      MULTER_MESSAGES.test(message)
    ) {
      response.status(status).json({ statusCode: status, message: MALFORMED_UPLOAD });
      return;
    }

    response.status(status).json(exception.getResponse());
  }
}

/**
 * Images d'une fiche, côté administration (spec 016, contracts/http.md).
 *
 * Contrôleur mince : il lit la requête et délègue. Les droits (un `ADMIN` ne
 * touche qu'aux images d'un brouillon), les plafonds et le stockage sont dans
 * `EntryImagesService`.
 *
 * Un **interceptor** NestJS s'exécute autour du gestionnaire de la route.
 * `FileInterceptor` lit le corps `multipart/form-data` avec multer : le
 * fichier arrive dans `@UploadedFile()`, en mémoire seulement (rien sur
 * disque), coupé au-delà de 10 Mo ; les autres parties arrivent dans
 * `@Body()`, validées par le DTO comme un corps JSON.
 */
@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminEntryImagesController {
  constructor(private readonly images: EntryImagesService) {}

  @Post('entries/:entryId/images')
  @HttpCode(HttpStatus.CREATED)
  @UseFilters(UploadErrorsFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      // Ni `dest` ni `storage` : multer garde le fichier en mémoire (rien
      // sur disque). Ne pas importer `multer` ici : ce n'est pas une
      // dépendance directe du backend (pnpm refuserait l'import au démarrage).
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, fieldSize: 2048, parts: 4 },
    }),
  )
  upload(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    // Seul le contenu est lu : ni le nom ni le type annoncé ne sont fiables.
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body() dto: UploadEntryImageDto,
    @CurrentAdminRole() role: AdminRole,
    @CurrentUserId() userId: string,
  ) {
    return this.images.upload(entryId, file, dto, role, userId);
  }

  @Patch('entries/:entryId/images/:imageId')
  update(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateEntryImageDto,
    @CurrentAdminRole() role: AdminRole,
  ) {
    return this.images.update(entryId, imageId, dto, role);
  }

  @Delete('entries/:entryId/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentAdminRole() role: AdminRole,
  ): Promise<void> {
    return this.images.remove(entryId, imageId, role);
  }

  @Get('images/usage')
  usage() {
    return this.images.usage();
  }
}
