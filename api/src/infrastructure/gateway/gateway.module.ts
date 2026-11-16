import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_GATEWAY } from '../../application/ports/payment-gateway';
import { Env } from '../config/env.validation';
import { SystemClock } from '../system/system-adapters';
import { CircuitBreakerPaymentGateway } from './circuit-breaker-payment-gateway';
import { HttpPaymentGateway } from './http-payment-gateway';

/** Timeouts or 5xx answers in a row before the gateway is left alone. */
const FAILURES_TO_OPEN = 5;
const COOLDOWN_MS = 30_000;

@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const logger = new Logger('PaymentGateway');
        const http = new HttpPaymentGateway({
          baseUrl: config.get('GATEWAY_BASE_URL', { infer: true }),
          privateKey: config.get('GATEWAY_PRIVATE_KEY', { infer: true }),
          integritySecret: config.get('GATEWAY_INTEGRITY_SECRET', {
            infer: true,
          }),
          timeoutMs: config.get('GATEWAY_TIMEOUT_MS', { infer: true }),
        });
        return new CircuitBreakerPaymentGateway(
          http,
          { failureThreshold: FAILURES_TO_OPEN, cooldownMs: COOLDOWN_MS },
          new SystemClock(),
          (state) => logger.warn(`Circuit breaker is now ${state}`),
        );
      },
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class GatewayModule {}
