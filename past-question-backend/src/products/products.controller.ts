import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ProductsService } from './products.service.js';
import { Public, Roles } from '../common/decorators/auth.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
class ProductFields {
  @IsString() @MinLength(1) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(1) price!: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() course?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsString() examType?: string;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED']) status?: string;
  @IsOptional() @IsString() coverImageKey?: string;
}
class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) price?: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() course?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsString() institution?: string;
  @IsOptional() @IsString() examType?: string;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED']) status?: string;
  @IsOptional() @IsString() coverImageKey?: string;
}
@Controller('products')
export class ProductsController {
  constructor(private readonly s: ProductsService) {}
  @Public() @Get() list(@Query() q: any) {
    return this.s.list(q);
  }
  @Public() @Get(':id') get(@Param('id') id: string) {
    return this.s.get(id);
  }
}
@Controller('admin/products')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminProductsController {
  constructor(private readonly s: ProductsService) {}
  @Get() list(@Query() q: any) {
    return this.s.list(q, true);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.s.get(id, true);
  }
  @Post() create(@Body() d: ProductFields, @CurrentUser() u: any) {
    return this.s.create(d, u.id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() d: UpdateProductDto,
    @CurrentUser() u: any,
  ) {
    return this.s.update(id, d, u.id);
  }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() u: any) {
    return this.s.remove(id, u.id);
  }
  @Post(':id/archive') archive(@Param('id') id: string, @CurrentUser() u: any) {
    return this.s.archive(id, u.id);
  }
}
