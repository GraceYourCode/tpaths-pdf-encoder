import { plainToInstance } from 'class-transformer';
import { assertProductionPolicy } from './production-policy.js';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Preview = 'preview',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api';

  @IsString()
  @IsOptional()
  API_VERSION: string = '1';

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = '*';

  /** Rate-limit window in milliseconds. */
  @IsInt()
  @Min(1000)
  @IsOptional()
  THROTTLE_TTL_MS: number = 60000;

  /** Maximum requests allowed per window per client. */
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_LIMIT: number = 120;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  if (validated.NODE_ENV === NodeEnv.Production) {
    assertProductionPolicy(process.env as Record<string, string | undefined>);
  }

  return validated;
}
