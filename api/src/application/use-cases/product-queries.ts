import { ProductRepository } from '../ports/product.repository';
import {
  calculatePaymentSummary,
  Fees,
  PaymentSummary,
  PaymentSummaryError,
} from '../../domain/payment/payment-summary';
import {
  Product,
  reserveStock,
  StockError,
} from '../../domain/product/product';
import { andThen, err, ok, Result } from '../../domain/shared/result';

export type ProductNotFound = 'PRODUCT_NOT_FOUND';

export type QuoteError = ProductNotFound | StockError | PaymentSummaryError;

/** Read-only questions about the products of the store. */
export class ProductQueries {
  constructor(
    private readonly products: ProductRepository,
    private readonly fees: Fees,
  ) {}

  list(): Promise<Product[]> {
    return this.products.findAll();
  }

  async get(id: string): Promise<Result<Product, ProductNotFound>> {
    const product = await this.products.findById(id);
    return product ? ok(product) : err('PRODUCT_NOT_FOUND');
  }

  /**
   * What the customer would pay right now. It uses the same calculation as
   * the purchase, so the summary shown and the amount charged always match.
   */
  async quote(
    productId: string,
    quantity: number,
  ): Promise<Result<PaymentSummary, QuoteError>> {
    const product = await this.products.findById(productId);
    if (!product) {
      return err('PRODUCT_NOT_FOUND');
    }
    return andThen(reserveStock(product, quantity), () =>
      calculatePaymentSummary(
        { unitPriceInCents: product.priceInCents, quantity },
        this.fees,
      ),
    );
  }
}
