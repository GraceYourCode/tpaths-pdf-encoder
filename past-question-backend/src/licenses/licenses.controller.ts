import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { LicensesService } from './licenses.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/auth.decorator.js';
import { Throttle } from '../common/decorators/throttle.decorator.js';

class ActivateDto {
  @IsString() @MinLength(12) token!: string;
  @IsString() deviceId!: string;
}

class ValidateDto {
  @IsOptional() @IsString() deviceId?: string;
}

@Controller('licenses')
export class LicensesController {
  constructor(private readonly s: LicensesService) {}
  @Throttle(10, 60000) @Post('activate') activate(
    @CurrentUser() u: any,
    @Body() d: ActivateDto,
  ) {
    return this.s.activate(u.id, d);
  }
  @Get() list(@CurrentUser() u: any) {
    return this.s.list(u.id);
  }
  @Get(':id') get(@CurrentUser() u: any, @Param('id') id: string) {
    return this.s.get(u.id, id);
  }
  @Post(':id/validate') validate(
    @CurrentUser() u: any,
    @Param('id') id: string,
    @Body() d: ValidateDto,
  ) {
    return this.s.validate(u.id, id, d.deviceId);
  }
}

@Controller('admin/licenses')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminLicensesController {
  constructor(private readonly s: LicensesService) {}
  @Get() list() {
    return this.s.adminList({});
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.s.adminGet(id);
  }
  @Post(':id/suspend') suspend(@Param('id') id: string, @CurrentUser() u: any) {
    return this.s.setStatus(id, 'SUSPENDED', u.id);
  }
  @Post(':id/revoke') revoke(@Param('id') id: string, @CurrentUser() u: any) {
    return this.s.setStatus(id, 'REVOKED', u.id);
  }
}
