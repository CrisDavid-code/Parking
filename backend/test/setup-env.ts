process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/veyro_test?schema=public';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.THROTTLE_DISABLED = 'true';
process.env.BILLING_PROVIDER = 'testpay';
process.env.BILLING_WEBHOOK_SECRET = 'whsec_test';
