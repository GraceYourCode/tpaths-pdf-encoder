import { Module } from '@nestjs/common';
import { LicensesService } from './licenses.service.js';
import {
  LicensesController,
  AdminLicensesController,
} from './licenses.controller.js';
@Module({
  controllers: [LicensesController, AdminLicensesController],
  providers: [LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
