import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/auth.decorator.js';
@Controller('openapi')
export class OpenApiController {
 @Public()
 @Get('json')
 document(){
  return {openapi:'3.0.3',info:{title:'Past Question Platform API',version:'1.0.0'},servers:[{url:'/api/v1'}],security:[{bearerAuth:[]}],components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}}},paths:{
   '/auth/register':{post:{summary:'Register student'}},'/auth/login':{post:{summary:'Login'}},'/auth/refresh':{post:{summary:'Rotate refresh token'}},'/auth/logout':{post:{summary:'Logout'}},'/auth/verify-email':{post:{summary:'Verify email'}},'/auth/forgot-password':{post:{summary:'Request password reset'}},'/auth/reset-password':{post:{summary:'Reset password'}},
   '/products':{get:{summary:'List active products'}},'/products/{id}':{get:{summary:'Get active product'}},'/licenses/activate':{post:{summary:'Activate token'}},'/content/{documentId}/access':{post:{summary:'Authorize protected document access'}},'/payments/verify':{post:{summary:'Verify payment'}},'/payments/webhook':{post:{summary:'Payment webhook'}},
   '/admin/dashboard':{get:{summary:'Admin dashboard'}},'/admin/products':{get:{summary:'List products'},post:{summary:'Create product'}},'/admin/tokens':{get:{summary:'List activation tokens'},post:{summary:'Create activation token'}},'/admin/licenses':{get:{summary:'List licenses'}},'/admin/purchases':{get:{summary:'List purchases'}}
  }};
 }
}
