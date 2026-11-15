import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ProductQueries } from '../../../application/use-cases/product-queries';
import { httpErrorFor } from '../errors/http-error';
import { QuantityQueryDto } from '../transactions/create-transaction.dto';

/** Translates HTTP to use cases and back. It holds no business rule. */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductQueries) {}

  @Get()
  findAll() {
    return this.products.list();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.products.get(id);
    if (!result.ok) {
      throw httpErrorFor(result.error);
    }
    return result.value;
  }

  @Get(':id/payment-summary')
  async paymentSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QuantityQueryDto,
  ) {
    const result = await this.products.quote(id, query.quantity);
    if (!result.ok) {
      throw httpErrorFor(result.error);
    }
    return { productId: id, quantity: query.quantity, ...result.value };
  }
}
