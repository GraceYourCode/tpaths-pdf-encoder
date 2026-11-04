import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { Roles } from '../common/decorators/auth.decorator.js'; import { IsInt, IsOptional, IsString, Min } from 'class-validator'; import { PaymentsService } from './payments.service.js'; import { CurrentUser } from '../common/decorators/current-user.decorator.js'; import { Public } from '../common/decorators/auth.decorator.js'; import type { AuthRequest } from '../common/guards/auth.guard.js'; class InitializeDto{@IsString() productId!:string;} class VerifyDto{@IsString() reference!:string;@IsString() productId!:string;@IsOptional() @IsInt() @Min(1) amount?:number;} @Controller('payments') export class PaymentsController{constructor(private readonly s:PaymentsService){} @Post('initialize') initialize(@CurrentUser() u:any,@Body() d:InitializeDto,@Req() r:AuthRequest){return this.s.initialize(u.id,d.productId,r.ip)} @Post('verify') verify(@CurrentUser() u:any,@Body() d:VerifyDto,@Req() r:AuthRequest){return this.s.verify(u.id,d,r.ip)}} @Controller('payments/webhook') export class PaymentWebhookController{constructor(private readonly s:PaymentsService){} @Public() @Post() webhook(@Body() d:any,@Headers('x-paystack-signature') sig:string|undefined,@Req() r:AuthRequest){const raw=(r as any).rawBody;if(typeof raw!=='string' && !Buffer.isBuffer(raw))throw new BadRequestException('Raw body unavailable');this.s.verifyWebhook(raw.toString(),sig ?? '');return this.s.webhook(d,r.ip)}}

@Controller('admin/payments')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminPaymentsController {
  constructor(private readonly s: PaymentsService) {}
  @Get() list(@Query() q: any) {
    return this.s.adminList(q);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.s.adminGet(id);
  }
  @Post('reconcile') reconcile(@Body() d: { olderThanMinutes?: number; limit?: number }) {
    return this.s.reconcile(d?.olderThanMinutes ?? 15, d?.limit ?? 50);
  }
}
