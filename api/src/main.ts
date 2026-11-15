import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Env } from './infrastructure/config/env.validation';
import { configureApp } from './infrastructure/http/configure-app';
import { setupApiDocs } from './infrastructure/http/docs/api-docs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupApiDocs(app);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
