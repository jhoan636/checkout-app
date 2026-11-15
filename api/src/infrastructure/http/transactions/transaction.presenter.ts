import { OrderDetails } from '../../../application/ports/transaction.repository';
import { Transaction } from '../../../domain/transaction/transaction';

/** What the API shows of a transaction. Internal gateway ids stay inside. */
export const presentTransaction = (transaction: Transaction) => ({
  id: transaction.id,
  reference: transaction.reference,
  status: transaction.status,
  productId: transaction.productId,
  quantity: transaction.quantity,
  unitPriceInCents: transaction.unitPriceInCents,
  baseFeeInCents: transaction.baseFeeInCents,
  deliveryFeeInCents: transaction.deliveryFeeInCents,
  amountInCents: transaction.amountInCents,
  currency: transaction.currency,
  createdAt: transaction.createdAt.toISOString(),
  updatedAt: transaction.updatedAt.toISOString(),
});

const VISIBLE_PHONE_DIGITS = 3;

/** a***@example.com: enough to recognise it, not enough to harvest it. */
export const maskEmail = (email: string): string => {
  const at = email.lastIndexOf('@');
  return at < 1 ? '***' : `${email[0]}***${email.slice(at)}`;
};

export const maskPhone = (phone: string): string =>
  `${'*'.repeat(Math.max(phone.length - VISIBLE_PHONE_DIGITS, 0))}${phone.slice(-VISIBLE_PHONE_DIGITS)}`;

/** Contact data is masked: this endpoint has no login in front of it. */
export const presentCustomer = ({ transaction, customer }: OrderDetails) => ({
  transactionId: transaction.id,
  fullName: customer.fullName,
  email: maskEmail(customer.email),
  phone: maskPhone(customer.phone),
});

export const presentDelivery = ({ transaction, delivery }: OrderDetails) => ({
  transactionId: transaction.id,
  status: delivery.status,
  addressLine: delivery.addressLine,
  city: delivery.city,
  region: delivery.region,
  postalCode: delivery.postalCode,
});
