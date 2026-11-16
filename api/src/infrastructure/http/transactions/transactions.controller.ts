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
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { isUUID } from 'class-validator';
import { CreateTransactionUseCase } from '../../../application/use-cases/create-transaction.use-case';
import { GetOrderDetailsUseCase } from '../../../application/use-cases/get-order-details.use-case';
import { GetTransactionUseCase } from '../../../application/use-cases/get-transaction.use-case';
import {
  CustomerResponse,
  DeliveryResponse,
  ErrorResponse,
  TransactionResponse,
} from '../docs/responses.dto';
import { respond } from '../errors/http-error';
import { CreateTransactionDto } from './create-transaction.dto';
import {
  presentCustomer,
  presentDelivery,
  presentTransaction,
} from './transaction.presenter';

export const PURCHASES_PER_MINUTE = 10;

const NOT_FOUND = 'The transaction does not exist.';
const BAD_ID = 'The id is not a UUID.';

/** Translates HTTP to use cases and back. It holds no business rule. */
@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly getTransaction: GetTransactionUseCase,
    private readonly getOrderDetails: GetOrderDetailsUseCase,
  ) {}

  // Creating purchases is the costly call: a tighter limit than reading.
  @Throttle({ default: { limit: PURCHASES_PER_MINUTE, ttl: 60_000 } })
  @Post()
  @ApiOperation({
    summary: 'Create a purchase and charge it',
    description:
      'Stores the purchase as PENDING, charges the card token through the ' +
      'payment gateway and returns the transaction. The status is usually ' +
      'PENDING: read the transaction again until it is final. The amount is ' +
      'calculated by the server from the stored price.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'UUID chosen by the client. Sending the same key again returns the ' +
      'same transaction and never charges twice.',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiCreatedResponse({ type: TransactionResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description: 'Invalid body, unknown field or missing Idempotency-Key.',
  })
  @ApiNotFoundResponse({
    type: ErrorResponse,
    description: 'The product does not exist.',
  })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: 'Not enough units in stock.',
  })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse })
  @ApiTooManyRequestsResponse({ description: 'Too many purchases.' })
  async create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateTransactionDto,
  ): Promise<TransactionResponse> {
    if (!isUUID(idempotencyKey)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'INVALID_IDEMPOTENCY_KEY',
        message: 'The Idempotency-Key header must be a UUID.',
      });
    }

    return respond(
      await this.createTransaction.execute({
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
      }),
      presentTransaction,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Read a transaction with its latest status',
    description:
      'While the transaction is PENDING the payment gateway is asked again, ' +
      'so polling this endpoint resolves the purchase.',
  })
  @ApiOkResponse({ type: TransactionResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: BAD_ID })
  @ApiNotFoundResponse({ type: ErrorResponse, description: NOT_FOUND })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponse> {
    return respond(await this.getTransaction.execute(id), presentTransaction);
  }

  @Get(':id/customer')
  @ApiOperation({
    summary: 'Read the customer of a purchase',
    description: 'Email and phone are masked.',
  })
  @ApiOkResponse({ type: CustomerResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: BAD_ID })
  @ApiNotFoundResponse({ type: ErrorResponse, description: NOT_FOUND })
  async findCustomer(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerResponse> {
    return respond(await this.getOrderDetails.execute(id), presentCustomer);
  }

  @Get(':id/delivery')
  @ApiOperation({ summary: 'Read the delivery of a purchase' })
  @ApiOkResponse({ type: DeliveryResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: BAD_ID })
  @ApiNotFoundResponse({ type: ErrorResponse, description: NOT_FOUND })
  async findDelivery(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeliveryResponse> {
    return respond(await this.getOrderDetails.execute(id), presentDelivery);
  }
}
