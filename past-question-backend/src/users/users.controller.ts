import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) firstName?: string;
  @IsOptional() @IsString() @MinLength(1) lastName?: string;
  @IsOptional() @IsString() @MinLength(12) password?: string;
}

@Controller('users/me')
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get() me(@CurrentUser() u: any) {
    return this.service.me(u.id);
  }
  @Patch() update(@CurrentUser() u: any, @Body() d: UpdateUserDto) {
    return this.service.update(u.id, d);
  }
  @Get('licenses') licenses(@CurrentUser() u: any) {
    return this.service.licenses(u.id);
  }
  @Get('purchases') purchases(@CurrentUser() u: any) {
    return this.service.purchases(u.id);
  }
  @Get('devices') devices(@CurrentUser() u: any) {
    return this.service.devices(u.id);
  }
}
