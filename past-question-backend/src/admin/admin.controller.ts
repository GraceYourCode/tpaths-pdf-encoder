import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { AdminService } from './admin.service.js';
import { LicensesService } from '../licenses/licenses.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/auth.decorator.js';

class StatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'PENDING']) status!: string;
}

class TokenCreateDto {
  @IsString() productId!: string;
  @IsDateString() @IsOptional() expiresAt?: string;
}

@Controller('admin/dashboard')
@Roles('ADMIN', 'SUPER_ADMIN')
export class DashboardController {
  constructor(private readonly s: AdminService) {}
  @Get() get() {
    return this.s.dashboard();
  }
}

@Controller('admin/students')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminStudentsController {
  constructor(private readonly s: AdminService) {}
  @Get() list(@Query() q: any) {
    return this.s.students(q);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.s.student(id);
  }
  @Patch(':id/status') status(
    @Param('id') id: string,
    @Body() d: StatusDto,
    @CurrentUser() u: any,
  ) {
    return this.s.status(id, d.status, u.id);
  }
  @Get(':id/licenses') licenses(@Param('id') id: string) {
    return this.s.student(id).then((x) => x.licenses);
  }
  @Get(':id/purchases') purchases(@Param('id') id: string) {
    return this.s.student(id).then((x) => x.purchases);
  }
  @Get(':id/devices') devices(@Param('id') id: string) {
    return this.s.student(id).then((x) => x.devices);
  }
}

@Controller('admin/audit-logs')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AuditController {
  constructor(private readonly s: AdminService) {}
  @Get() list(@Query() q: any) {
    return this.s.auditLogs(q);
  }
}

@Controller('admin/tokens')
@Roles('ADMIN', 'SUPER_ADMIN')
export class TokenController {
  constructor(
    private readonly s: AdminService,
    private readonly licenses: LicensesService,
  ) {}
  @Post() create(@Body() d: TokenCreateDto) {
    return this.licenses.generateToken(
      d.productId,
      d.expiresAt ? new Date(d.expiresAt) : undefined,
    );
  }
  @Get() list(@Query() q: any) {
    return this.s.tokens(q);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.s.token(id);
  }
  @Post(':id/suspend') suspend(@Param('id') id: string, @CurrentUser() u: any) {
    return this.s.tokenStatus(id, 'SUSPENDED', u.id);
  }
  @Post(':id/revoke') revoke(@Param('id') id: string, @CurrentUser() u: any) {
    return this.s.tokenStatus(id, 'REVOKED', u.id);
  }
}
