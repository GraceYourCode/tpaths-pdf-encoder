import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocumentsService } from './documents.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/auth.decorator.js';
class DocumentDto {
  @IsString() title!: string;
  @IsOptional() @IsIn(['READY', 'DISABLED', 'DELETED']) status?: string;
}

class UploadDto {
  @IsString() title!: string;
  /** Previous document to replace. Its READY version is disabled atomically on success. */
  @IsOptional() @IsUUID() replacesDocumentId?: string;
}

class DocumentUpdateDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsIn(['READY', 'DISABLED']) status?: string;
}
@Controller('admin/products/:productId/documents')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminProductDocumentsController {
  constructor(private readonly documentService: DocumentsService) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_r, f, cb) => cb(null, f.mimetype === 'application/pdf'),
    }),
  )
  create(
    @Param('productId') productId: string,
    @UploadedFile() file: any,
    @Body() d: UploadDto,
    @CurrentUser() u: any,
  ) {
    return this.documentService.create(productId, file, d, u.id, d.replacesDocumentId);
  }
  @Get() list(@Param('productId') productId: string) {
    return this.documentService.list(productId, true);
  }
}
@Controller('admin/documents')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminDocumentsController {
  constructor(private readonly documentService: DocumentsService) {}
  @Get(':id') get(@Param('id') id: string) {
    return this.documentService.get(id, true);
  }
  @Post(':id/retry') retry(@Param('id') id: string, @CurrentUser() u: any) {
    return this.documentService.retry(id, u.id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() d: DocumentUpdateDto,
    @CurrentUser() u: any,
  ) {
    return this.documentService.update(id, d, u.id);
  }
  /** Tombstone: marks the document DELETED and removes its stored object. */
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() u: any) {
    return this.documentService.remove(id, u.id);
  }
}
