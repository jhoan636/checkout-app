import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProductQueries } from '../../../application/use-cases/product-queries';
import {
  ErrorResponse,
  PaymentSummaryResponse,
  ProductResponse,
} from '../docs/responses.dto';
import { httpErrorFor } from '../errors/http-error';
import { QuantityQueryDto } from '../transactions/create-transaction.dto';

const NOT_FOUND = 'The product does not exist.';

/** Translates HTTP to use cases and back. It holds no business rule. */
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductQueries) {}

  @Get()
  @ApiOperation({ summary: 'List the products with their stock' })
  @ApiOkResponse({ type: ProductResponse, isArray: true })
  findAll(): Promise<ProductResponse[]> {
    return this.products.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one product with its stock' })
  @ApiOkResponse({ type: ProductResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description: 'The id is not a UUID.',
  })
  @ApiNotFoundResponse({ type: ErrorResponse, description: NOT_FOUND })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponse> {
    const result = await this.products.get(id);
    if (!result.ok) {
      throw httpErrorFor(result.error);
    }
    return result.value;
  }

  @Get(':id/payment-summary')
  @ApiOperation({
    summary: 'Calculate what a purchase would cost',
    description:
      'Product amount, base fee and delivery fee. It is the same calculation ' +
      'used when the purchase is created.',
  })
  @ApiOkResponse({ type: PaymentSummaryResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description: 'Invalid id or quantity.',
  })
  @ApiNotFoundResponse({ type: ErrorResponse, description: NOT_FOUND })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: 'Not enough units in stock.',
  })
  async paymentSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QuantityQueryDto,
  ): Promise<PaymentSummaryResponse> {
    const result = await this.products.quote(id, query.quantity);
    if (!result.ok) {
      throw httpErrorFor(result.error);
    }
    return { productId: id, quantity: query.quantity, ...result.value };
  }
}
