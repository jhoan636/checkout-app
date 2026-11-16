import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Env, validateEnv } from './infrastructure/config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { GatewayModule } from './infrastructure/gateway/gateway.module';
import { UseCasesModule } from './infrastructure/wiring/use-cases.module';
import { ProductsController } from './infrastructure/http/products/products.controller';
import { TransactionsController } from './infrastructure/http/transactions/transactions.controller';
import { GatewayWebhookController } from './infrastructure/http/webhooks/gateway-webhook.controller';
import { RootController } from './infrastructure/http/docs/root.controller';
import { HealthController } from './infrastructure/http/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          ttl: 60_000,
          limit: config.get('RATE_LIMIT_PER_MINUTE', { infer: true }),
        },
      ],
    }),
    DatabaseModule,
    PersistenceModule,
    GatewayModule,
    UseCasesModule,
  ],
  controllers: [
    RootController,
    HealthController,
    ProductsController,
    TransactionsController,
    GatewayWebhookController,
  ],
  // Rate limit on every endpoint: slows down brute force and abuse.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
