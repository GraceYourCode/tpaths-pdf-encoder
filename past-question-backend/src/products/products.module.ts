import { Module } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import {
  ProductsController,
  AdminProductsController,
} from './products.controller.js';
@Module({
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
