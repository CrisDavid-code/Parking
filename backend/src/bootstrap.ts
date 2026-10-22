import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { config } from './config';

/** Shared HTTP setup for main.ts and e2e tests so tests exercise the real pipeline. */
export function configureApp(app: INestApplication) {
  const c = config();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/live'] });
  app.use(helmet());
  app.enableCors({ origin: c.corsOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();
  return app;
}

export function setupSwagger(app: INestApplication) {
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Veyro API').setDescription('Parking, tracking and indoor navigation API').setVersion('1.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('api/docs', app, doc, { jsonDocumentUrl: 'api/openapi.json' });
  return doc;
}
