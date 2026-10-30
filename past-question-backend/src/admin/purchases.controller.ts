import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/auth.decorator.js';
import { PrismaService } from '../database/prisma.service.js';
@Controller('admin/purchases')
@Roles('ADMIN','SUPER_ADMIN')
export class AdminPurchasesController {
 constructor(private readonly prisma:PrismaService){}
 @Get() list(@Query() q:any){const page=Math.max(1,Number(q.page||1));const limit=Math.min(100,Math.max(1,Number(q.limit||20)));return (this.prisma as any).purchase.findMany({skip:(page-1)*limit,take:limit,orderBy:{createdAt:'desc'},include:{user:{select:{id:true,email:true,firstName:true,lastName:true}},product:{select:{id:true,title:true}},payment:{select:{reference:true,status:true,amount:true,currency:true}},license:{select:{id:true,status:true,deviceId:true}}}});}
 @Get(':id') get(@Param('id') id:string){return (this.prisma as any).purchase.findUnique({where:{id},include:{user:{select:{id:true,email:true,firstName:true,lastName:true}},product:true,payment:{select:{reference:true,status:true,amount:true,currency:true}},license:true}})}
}
