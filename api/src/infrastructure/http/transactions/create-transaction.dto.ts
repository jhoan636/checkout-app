import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const MAX_UNITS_PER_PURCHASE = 10;
export const MAX_INSTALLMENTS = 36;

/** Removes surrounding spaces, so "  Ana  " and "Ana" are the same value. */
const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CustomerDto {
  @Trim()
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @Trim()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Digits only, with an optional leading +. */
  @Trim()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phone must have between 7 and 15 digits',
  })
  phone!: string;
}

export class DeliveryDto {
  @Trim()
  @IsString()
  @Length(5, 200)
  addressLine!: string;

  @Trim()
  @IsString()
  @Length(2, 80)
  city!: string;

  @Trim()
  @IsString()
  @Length(2, 80)
  region!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(3, 12)
  postalCode?: string;
}

/**
 * There is no field for the card number, expiry date or security code: the
 * browser exchanges them for a token directly with the gateway.
 */
export class PaymentDto {
  @IsString()
  @Length(1, 128)
  cardToken!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_INSTALLMENTS)
  installments!: number;

  @IsString()
  @Length(1, 4096)
  acceptanceToken!: string;

  @IsString()
  @Length(1, 4096)
  personalDataAuthToken!: string;
}

export class CreateTransactionDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UNITS_PER_PURCHASE)
  quantity!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery!: DeliveryDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => PaymentDto)
  payment!: PaymentDto;
}

export class QuantityQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_UNITS_PER_PURCHASE)
  quantity!: number;
}
