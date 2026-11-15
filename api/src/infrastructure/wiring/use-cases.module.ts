import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '../../application/ports/payment-gateway';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from '../../application/ports/product.repository';
import {
  Clock,
  CLOCK,
  FEES,
  ID_GENERATOR,
  IdGenerator,
} from '../../application/ports/system';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from '../../application/ports/transaction.repository';
import { TransactionSettlement } from '../../application/services/transaction-settlement';
import { CreateTransactionUseCase } from '../../application/use-cases/create-transaction.use-case';
import { GetTransactionUseCase } from '../../application/use-cases/get-transaction.use-case';
import { Fees } from '../../domain/payment/payment-summary';
import { Env } from '../config/env.validation';
import { GatewayModule } from '../gateway/gateway.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { SystemClock, UuidGenerator } from '../system/system-adapters';

/**
 * The application layer has no framework code, so its classes are built here:
 * each factory receives the adapters and passes them to a plain constructor.
 */
@Module({
  imports: [PersistenceModule, GatewayModule],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    {
      provide: FEES,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Fees => ({
        baseFeeInCents: config.get('BASE_FEE_IN_CENTS', { infer: true }),
        deliveryFeeInCents: config.get('DELIVERY_FEE_IN_CENTS', {
          infer: true,
        }),
      }),
    },
    {
      provide: TransactionSettlement,
      inject: [TRANSACTION_REPOSITORY, CLOCK],
      useFactory: (transactions: TransactionRepository, clock: Clock) =>
        new TransactionSettlement(transactions, clock),
    },
    {
      provide: CreateTransactionUseCase,
      inject: [
        PRODUCT_REPOSITORY,
        TRANSACTION_REPOSITORY,
        PAYMENT_GATEWAY,
        TransactionSettlement,
        CLOCK,
        ID_GENERATOR,
        FEES,
      ],
      useFactory: (
        products: ProductRepository,
        transactions: TransactionRepository,
        gateway: PaymentGateway,
        settlement: TransactionSettlement,
        clock: Clock,
        ids: IdGenerator,
        fees: Fees,
      ) =>
        new CreateTransactionUseCase(
          products,
          transactions,
          gateway,
          settlement,
          clock,
          ids,
          fees,
        ),
    },
    {
      provide: GetTransactionUseCase,
      inject: [TRANSACTION_REPOSITORY, PAYMENT_GATEWAY, TransactionSettlement],
      useFactory: (
        transactions: TransactionRepository,
        gateway: PaymentGateway,
        settlement: TransactionSettlement,
      ) => new GetTransactionUseCase(transactions, gateway, settlement),
    },
  ],
  exports: [
    CreateTransactionUseCase,
    GetTransactionUseCase,
    TransactionSettlement,
  ],
})
export class UseCasesModule {}
