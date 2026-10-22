/** Centralised env access. Fails fast on missing/insecure values outside tests. */
function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing required env var ${name}`);
  return v;
}

export const config = () => {
  const env = process.env.NODE_ENV ?? 'development';
  const jwtSecret = req('JWT_SECRET', env === 'production' ? undefined : 'dev-only-insecure-secret-change-me');
  if (env === 'production' && jwtSecret.length < 32) throw new Error('JWT_SECRET must be >= 32 chars in production');
  return {
    env,
    port: Number(process.env.PORT ?? 3000),
    jwtSecret,
    accessTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
    refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8080').split(',').map((s) => s.trim()).filter(Boolean),
    appUrl: process.env.APP_URL ?? 'http://localhost:5173',
    locationRetentionDays: Number(process.env.LOCATION_RETENTION_DAYS ?? 90),
    positionEstimateRetentionDays: Number(process.env.POSITION_ESTIMATE_RETENTION_DAYS ?? 30),
    retentionJobEnabled: process.env.RETENTION_JOB_ENABLED === 'true',
    billingWebhookSecret: process.env.BILLING_WEBHOOK_SECRET ?? '',
    billingProvider: process.env.BILLING_PROVIDER ?? '',
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
    smtpUrl: process.env.SMTP_URL ?? '',
  };
};
export type AppConfig = ReturnType<typeof config>;
