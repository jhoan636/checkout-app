import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_GATEWAY } from '../../application/ports/payment-gateway';
import { Env } from '../config/env.validation';
import { HttpPaymentGateway } from './http-payment-gateway';

@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new HttpPaymentGateway({
          baseUrl: config.get('GATEWAY_BASE_URL', { infer: true }),
          privateKey: config.get('GATEWAY_PRIVATE_KEY', { infer: true }),
          integritySecret: config.get('GATEWAY_INTEGRITY_SECRET', {
            infer: true,
          }),
          timeoutMs: config.get('GATEWAY_TIMEOUT_MS', { infer: true }),
        }),
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class GatewayModule {}
