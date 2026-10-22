import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './bootstrap';

/** Writes docs/openapi.json without starting the HTTP server: `npm run openapi`. */
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  writeFileSync(process.argv[2] ?? '../docs/openapi.json', JSON.stringify(setupSwagger(app), null, 2));
  await app.close();
}
void main();
