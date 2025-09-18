import { StringifyEnv } from '@novu/shared';
import { bool, CleanedEnv, cleanEnv, json, num, port, str, ValidatorSpec } from 'envalid';

export function validateEnv() {
  return cleanEnv(process.env, envValidators);
}

export type ValidatedEnv = StringifyEnv<CleanedEnv<typeof envValidators>>;

export const envValidators = {
  JWT_SECRET: str(),
  MONGO_AUTO_CREATE_INDEXES: bool({ default: false }),
  MONGO_MAX_IDLE_TIME_IN_MS: num({ default: 1000 * 30 }),
  MONGO_MAX_POOL_SIZE: num({ default: 50 }),
  MONGO_MIN_POOL_SIZE: num({ default: 10 }),
  MONGO_URL: str(),
  NODE_ENV: str({ choices: ['dev', 'test', 'production', 'ci', 'local'], default: 'local' }),
  PORT: port(),
  REDIS_HOST: str(),
  REDIS_PORT: port(),
  REDIS_TLS: json({ default: undefined }),
  REDIS_MASTER_HOST: str({ default: '' }),
  REDIS_MASTER_PORT: str({ default: '' }),
  REDIS_SLAVE_HOST: str({ default: '' }),
  REDIS_SLAVE_PORT: str({ default: '' }),
  SENTRY_DSN: str({ default: undefined }),
  TZ: str({ default: 'UTC' }),
  WORKER_DEFAULT_CONCURRENCY: num({ default: undefined }),
  WORKER_DEFAULT_LOCK_DURATION: num({ default: undefined }),
  LAUNCH_DARKLY_SDK_KEY: str({ default: undefined }),
} satisfies Record<string, ValidatorSpec<unknown>>;
