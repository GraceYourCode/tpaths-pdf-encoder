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
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DocumentsService } from './documents.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/auth.decorator.js';
class DocumentDto {
  @IsString() title!: string;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED']) status?: string;
}
@Controller('admin/products/:productId/documents')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminProductDocumentsController {
  constructor(private readonly s: DocumentsService) {}
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
    @Body() d: DocumentDto,
    @CurrentUser() u: any,
  ) {
    return this.s.create(productId, file, d, u.id);
  }
  @Get() list(@Param('productId') productId: string) {
    return this.s.list(productId, true);
  }
}
@Controller('admin/documents')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminDocumentsController {
  constructor(private readonly s: DocumentsService) {}
  @Get(':id') get(@Param('id') id: string) {
    return this.s.get(id, true);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() d: DocumentDto,
    @CurrentUser() u: any,
  ) {
    return this.s.update(id, d, u.id);
  }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() u: any) {
    return this.s.remove(id, u.id);
  }
}
