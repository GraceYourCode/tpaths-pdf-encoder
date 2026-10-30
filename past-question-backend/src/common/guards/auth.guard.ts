import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { verifyJwt } from '../utils/crypto.js';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';
export interface AuthUser { id:string; role:string; sessionId:string; }
export interface AuthRequest extends Request { user?:AuthUser; }
@Injectable()
export class AuthGuard implements CanActivate {
 constructor(private readonly reflector:Reflector,private readonly config:ConfigService,private readonly prisma:PrismaService){}
 async canActivate(ctx:ExecutionContext):Promise<boolean>{ if(this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY,[ctx.getHandler(),ctx.getClass()]))return true; const req=ctx.switchToHttp().getRequest<AuthRequest>(); const header=req.headers.authorization; if(!header?.startsWith('Bearer '))throw new UnauthorizedException('Authentication required'); try{ const p=verifyJwt<{sub:string;role:string;sid:string}>(header.slice(7),this.config.getOrThrow<string>('security.accessSecret')); const session=await (this.prisma as any).session.findFirst({where:{id:p.sid,userId:p.sub,revokedAt:null,expiresAt:{gt:new Date()}}}); if(!session)throw new Error('session'); const user=await (this.prisma as any).user.findUnique({where:{id:p.sub},select:{id:true,role:true,status:true}}); if(!user||user.status!=='ACTIVE')throw new Error('user'); req.user={id:user.id,role:user.role,sessionId:session.id}; return true; }catch{throw new UnauthorizedException('Invalid or expired credentials');} }
}
