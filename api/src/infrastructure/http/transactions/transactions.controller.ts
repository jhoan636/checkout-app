import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { CreateTransactionUseCase } from '../../../application/use-cases/create-transaction.use-case';
import { GetOrderDetailsUseCase } from '../../../application/use-cases/get-order-details.use-case';
import { GetTransactionUseCase } from '../../../application/use-cases/get-transaction.use-case';
import { httpErrorFor } from '../errors/http-error';
import { CreateTransactionDto } from './create-transaction.dto';
import {
  presentCustomer,
  presentDelivery,
  presentTransaction,
} from './transaction.presenter';

/** Translates HTTP to use cases and back. It holds no business rule. */
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly getTransaction: GetTransactionUseCase,
    private readonly getOrderDetails: GetOrderDetailsUseCase,
  ) {}

  @Post()
  async create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateTransactionDto,
  ) {
    if (!isUUID(idempotencyKey)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_IDEMPOTENCY_KEY',
        message: 'The Idempotency-Key header must be a UUID.',
      });
    }

    const result = await this.createTransaction.execute({
      idempotencyKey,
      productId: body.productId,
      quantity: body.quantity,
      customer: {
        fullName: body.customer.fullName,
        email: body.customer.email,
        phone: body.customer.phone,
      },
      delivery: {
        addressLine: body.delivery.addressLine,
        city: body.delivery.city,
        region: body.delivery.region,
        postalCode: body.delivery.postalCode ?? null,
      },
      cardToken: body.payment.cardToken,
      installments: body.payment.installments,
      acceptanceToken: body.payment.acceptanceToken,
      personalDataAuthToken: body.payment.personalDataAuthToken,
    });
    if (!result.ok) {
      throw httpErrorFor(result.error);
    }
    return presentTransaction(result.value);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.getTransaction.execute(id);
    if (!result.ok) {
      throw httpErrorFor(result.error);
    }
    return presentTransaction(result.value);
  }

  @Get(':id/customer')
  async findCustomer(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.getOrderDetails.execute(id);
    if (!result.ok) {
      throw httpErrorFor(result.error);
    }
    return presentCustomer(result.value);
  }

  @Get(':id/delivery')
  async findDelivery(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.getOrderDetails.execute(id);
    if (!result.ok) {
      throw httpErrorFor(result.error);
    }
    return presentDelivery(result.value);
  }
}
