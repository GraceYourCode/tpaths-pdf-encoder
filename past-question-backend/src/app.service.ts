import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from './config/configuration.js';

export interface ServiceInfo {
  name: string;
  status: 'running';
  environment: string;
  apiVersion: string;
}

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Minimal service metadata for the API root. Deliberately non-sensitive:
   * exposes only what is safe for an unauthenticated caller to see.
   */
  getServiceInfo(): ServiceInfo {
    const app = this.configService.get<AppConfig>('app');
    return {
      name: 'past-question-backend',
      status: 'running',
      environment: app?.env ?? 'development',
      apiVersion: app?.apiVersion ?? '1',
    };
  }
}
