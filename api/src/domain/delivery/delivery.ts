export interface DeliveryAddress {
  readonly addressLine: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string | null;
}

/** PENDING until the payment is approved, then ASSIGNED to the customer. */
export type DeliveryStatus = 'PENDING' | 'ASSIGNED';
