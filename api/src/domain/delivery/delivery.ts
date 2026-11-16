export interface DeliveryAddress {
  readonly addressLine: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string | null;
}

/**
 * PENDING while the payment is not resolved. ASSIGNED to the customer when it
 * is approved; CANCELLED when it fails, because nothing will be sent.
 */
export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'CANCELLED';
