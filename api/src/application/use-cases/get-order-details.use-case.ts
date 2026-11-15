import {
  OrderDetails,
  TransactionRepository,
} from '../ports/transaction.repository';
import { err, ok, Result } from '../../domain/shared/result';

export type GetOrderDetailsError = 'TRANSACTION_NOT_FOUND';

/** The customer and the delivery that belong to a purchase. */
export class GetOrderDetailsUseCase {
  constructor(private readonly transactions: TransactionRepository) {}

  async execute(
    transactionId: string,
  ): Promise<Result<OrderDetails, GetOrderDetailsError>> {
    const order = await this.transactions.findOrderById(transactionId);
    return order ? ok(order) : err('TRANSACTION_NOT_FOUND');
  }
}
