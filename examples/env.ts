import { Static, t } from '../lib';
import { env, assertEnv } from '../lib/env';

const envSchema = t.Object({
  DATABASE_URL: t.String({
    format: 'uri',
  }),
});

assertEnv(envSchema);

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Static<typeof envSchema> {}
  }
}
