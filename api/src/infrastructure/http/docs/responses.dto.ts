import { ApiProperty } from '@nestjs/swagger';
import { TRANSACTION_STATUSES } from '../../../domain/transaction/transaction-status';
import type { TransactionStatus } from '../../../domain/transaction/transaction-status';
import type { DeliveryStatus } from '../../../domain/delivery/delivery';

/** Response shapes, written down so the API documentation is exact. */

const UUID_EXAMPLE = 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601';
const CENTS = 'Integer amount in cents of COP.';

export class ProductResponse {
  @ApiProperty({ format: 'uuid', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ example: 'Glide Camera Drone' })
  name!: string;

  @ApiProperty({ example: 'A foldable camera drone with a stabilised gimbal.' })
  description!: string;

  @ApiProperty({ description: CENTS, example: 45990000 })
  priceInCents!: number;

  @ApiProperty({ description: 'Units available right now.', example: 12 })
  stock!: number;

  @ApiProperty({ example: '/products/glide-drone.webp' })
  imageUrl!: string;
}

export class PaymentSummaryResponse {
  @ApiProperty({ format: 'uuid', example: UUID_EXAMPLE })
  productId!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ description: CENTS, example: 91980000 })
  subtotalInCents!: number;

  @ApiProperty({ description: `Always charged. ${CENTS}`, example: 300000 })
  baseFeeInCents!: number;

  @ApiProperty({ description: CENTS, example: 1200000 })
  deliveryFeeInCents!: number;

  @ApiProperty({ description: CENTS, example: 93480000 })
  totalInCents!: number;
}

export class TransactionResponse {
  @ApiProperty({
    format: 'uuid',
    description: 'Same value as the Idempotency-Key sent when it was created.',
    example: '7c1e8a52-6d0b-4a55-9a5e-0d3b8c1f7a10',
  })
  id!: string;

  @ApiProperty({ example: 'ORDER-7c1e8a52-6d0b-4a55-9a5e-0d3b8c1f7a10' })
  reference!: string;

  @ApiProperty({
    enum: TRANSACTION_STATUSES,
    description:
      'PENDING while the gateway decides; every other value is final.',
    example: 'PENDING',
  })
  status!: TransactionStatus;

  @ApiProperty({ format: 'uuid', example: UUID_EXAMPLE })
  productId!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ description: CENTS, example: 45990000 })
  unitPriceInCents!: number;

  @ApiProperty({ description: CENTS, example: 300000 })
  baseFeeInCents!: number;

  @ApiProperty({ description: CENTS, example: 1200000 })
  deliveryFeeInCents!: number;

  @ApiProperty({ description: `Total charged. ${CENTS}`, example: 93480000 })
  amountInCents!: number;

  @ApiProperty({ example: 'COP' })
  currency!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CustomerResponse {
  @ApiProperty({ format: 'uuid' })
  transactionId!: string;

  @ApiProperty({ example: 'Ana Gomez' })
  fullName!: string;

  @ApiProperty({ description: 'Masked.', example: 'a***@example.com' })
  email!: string;

  @ApiProperty({ description: 'Masked.', example: '*******567' })
  phone!: string;
}

export class DeliveryResponse {
  @ApiProperty({ format: 'uuid' })
  transactionId!: string;

  @ApiProperty({
    enum: ['PENDING', 'ASSIGNED', 'CANCELLED'],
    description:
      'ASSIGNED once the payment is approved, CANCELLED if it fails.',
  })
  status!: DeliveryStatus;

  @ApiProperty({ example: 'Calle 1 # 2-3' })
  addressLine!: string;

  @ApiProperty({ example: 'Bogota' })
  city!: string;

  @ApiProperty({ example: 'Cundinamarca' })
  region!: string;

  @ApiProperty({ type: String, nullable: true, example: '110111' })
  postalCode!: string | null;
}

export class ErrorResponse {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({
    description: 'Stable code for programs.',
    example: 'INSUFFICIENT_STOCK',
  })
  error!: string;

  @ApiProperty({
    description: 'Explanation for people.',
    example: 'There are not enough units in stock.',
  })
  message!: string;
}

export class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'up' })
  database!: string;
}

export class WebhookAckResponse {
  @ApiProperty({ example: true })
  received!: boolean;
}
