import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './bootstrap';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  if (config().env !== 'production' || process.env.SWAGGER_ENABLED === 'true') setupSwagger(app);
  await app.listen(config().port);
}
void bootstrap();
