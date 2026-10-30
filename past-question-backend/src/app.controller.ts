import { Controller, Get } from '@nestjs/common';

import { AppService, type ServiceInfo } from './app.service.js';

/**
 * Root controller. Serves a small, non-sensitive service descriptor at the API
 * root (`GET /api/v1`). Business endpoints live in their own feature modules.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getServiceInfo(): ServiceInfo {
    return this.appService.getServiceInfo();
  }
}
