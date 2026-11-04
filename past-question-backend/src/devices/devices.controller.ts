import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Roles } from '../common/decorators/auth.decorator.js'; import { IsOptional, IsString, MinLength } from 'class-validator'; import { DevicesService } from './devices.service.js'; import { CurrentUser } from '../common/decorators/current-user.decorator.js'; import type { AuthRequest } from '../common/guards/auth.guard.js';
class AdminRevokeDto { @IsString() @MinLength(3) reason!:string; }
class DeviceDto { @IsString() @MinLength(8) deviceId!:string; @IsString() platform!:string; @IsOptional() @IsString() appVersion?:string; @IsOptional() @IsString() publicKey?:string; }
@Controller('devices') export class DevicesController {constructor(private readonly s:DevicesService){} @Get() list(@CurrentUser() u:any){return this.s.list(u.id)} @Post('register') register(@CurrentUser() u:any,@Body() d:DeviceDto,@Req() r:AuthRequest){return this.s.register(u.id,d,r.ip)} @Post(':id/revoke') revoke(@CurrentUser() u:any,@Param('id') id:string){return this.s.revoke(u.id,id)} @Post(':id/validate') validate(@CurrentUser() u:any,@Param('id') id:string){return this.s.validate(u.id,id)} }

@Controller('admin/devices')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminDevicesController {
  constructor(private readonly s: DevicesService) {}
  /** Revoke any device. Subsequent artifact requests from it are refused. */
  @Post(':id/revoke')
  revoke(@CurrentUser() u: any, @Param('id') id: string, @Body() d: AdminRevokeDto) {
    return this.s.adminRevoke(id, u.id, d.reason);
  }
}
