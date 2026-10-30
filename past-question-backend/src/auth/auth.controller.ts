import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { AuthService } from './auth.service.js';
import { Public } from '../common/decorators/auth.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Throttle } from '../common/decorators/throttle.decorator.js';
import type { AuthRequest } from '../common/guards/auth.guard.js';
class RegisterDto {
  @IsEmail() email!: string;

  @IsString()
  @MinLength(12)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  password!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsString()
  @MinLength(1)
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'WhatsApp number must be a valid international phone number',
  })
  whatsapp: string;
}
class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
class TokenDto {
  @IsString() token!: string;
}
class ForgotDto {
  @IsEmail() email!: string;
}
class ResetDto {
  @IsString() token!: string;
  @IsString()
  @MinLength(12)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  password!: string;
}
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Throttle(5, 60000) @Post('register') register(
    @Body() d: RegisterDto,
    @Req() r: AuthRequest,
  ) {
    return this.auth.register(d);
  }
  @Public() @Throttle(10, 60000) @Post('login') login(
    @Body() d: LoginDto,
    @Req() r: AuthRequest,
  ) {
    return this.auth.login(d, r.ip, r.headers['user-agent']);
  }
  @Public() @Throttle(20, 60000) @Post('refresh') refresh(
    @Body() d: TokenDto,
    @Req() r: AuthRequest,
  ) {
    return this.auth.refresh(d.token, r.ip, r.headers['user-agent']);
  }
  @Post('logout') logout(@CurrentUser() u: any) {
    return this.auth.logout(u.sessionId).then(() => ({ loggedOut: true }));
  }
  @Post('logout-all') logoutAll(@CurrentUser() u: any) {
    return this.auth.logoutAll(u.id).then(() => ({ loggedOut: true }));
  }
  @Get('me') me(@CurrentUser() u: any) {
    return this.auth.me(u.id);
  }
  @Public() @Throttle(10, 60000) @Post('verify-email') verify(
    @Body() d: TokenDto,
  ) {
    return this.auth.verifyEmail(d.token);
  }
  @Public() @Throttle(5, 60000) @Post('resend-verification') resend(
    @Body() d: ForgotDto,
  ) {
    return this.auth.resendVerification(d.email).then((token) => ({
      sent: true,
      ...(token ? { verificationToken: token } : {}),
    }));
  }
  @Public() @Throttle(5, 60000) @Post('forgot-password') forgot(
    @Body() d: ForgotDto,
  ) {
    return this.auth.forgotPassword(d.email).then((token) => ({
      sent: true,
      ...(token ? { resetToken: token } : {}),
    }));
  }
  @Public() @Throttle(5, 60000) @Post('reset-password') reset(
    @Body() d: ResetDto,
  ) {
    return this.auth.resetPassword(d.token, d.password);
  }
}
