import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './infrastructure/config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { GatewayModule } from './infrastructure/gateway/gateway.module';
import { UseCasesModule } from './infrastructure/wiring/use-cases.module';
import { HealthController } from './infrastructure/http/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    PersistenceModule,
    GatewayModule,
    UseCasesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
