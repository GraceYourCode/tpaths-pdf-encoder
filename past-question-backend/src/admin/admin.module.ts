import { Module } from '@nestjs/common';
import { AdminPurchasesController } from './purchases.controller.js';
import { AdminService } from './admin.service.js';
import {
  DashboardController,
  AdminStudentsController,
  AuditController,
  TokenController,
} from './admin.controller.js';
import { LicensesModule } from '../licenses/licenses.module.js';

@Module({
  imports: [LicensesModule],
  controllers: [
    DashboardController,
    AdminStudentsController,
    AuditController,
    TokenController,
    AdminPurchasesController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
