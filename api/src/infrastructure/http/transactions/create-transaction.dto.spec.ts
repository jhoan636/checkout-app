import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateTransactionDto,
  QuantityQueryDto,
} from './create-transaction.dto';

const validBody = () => ({
  productId: 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601',
  quantity: 2,
  customer: {
    fullName: 'Ana Gomez',
    email: 'ana@example.com',
    phone: '3001234567',
  },
  delivery: {
    addressLine: 'Calle 1 # 2-3',
    city: 'Bogota',
    region: 'Cundinamarca',
  },
  payment: {
    cardToken: 'tok_test_123',
    installments: 1,
    acceptanceToken: 'acceptance-token',
    personalDataAuthToken: 'personal-auth-token',
  },
});

// Same options as the global ValidationPipe.
const errorsFor = async (body: unknown) => {
  const dto = plainToInstance(CreateTransactionDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return JSON.stringify(errors);
};

const without = (path: string) => {
  const body = validBody() as unknown as Record<
    string,
    Record<string, unknown>
  >;
  const [group, field] = path.split('.');
  if (field) {
    delete body[group][field];
  } else {
    delete (body as Record<string, unknown>)[group];
  }
  return body;
};

const withValue = (path: string, value: unknown) => {
  const body = validBody() as unknown as Record<
    string,
    Record<string, unknown>
  >;
  const [group, field] = path.split('.');
  if (field) {
    body[group][field] = value;
  } else {
    (body as Record<string, unknown>)[group] = value;
  }
  return body;
};

describe('CreateTransactionDto', () => {
  it('accepts a complete, well formed purchase', async () => {
    expect(await errorsFor(validBody())).toBe('[]');
  });

  it('accepts an optional postal code', async () => {
    expect(await errorsFor(withValue('delivery.postalCode', '110111'))).toBe(
      '[]',
    );
  });

  it('trims surrounding spaces in text fields', () => {
    const dto = plainToInstance(
      CreateTransactionDto,
      withValue('customer.fullName', '  Ana Gomez  '),
    );

    expect(dto.customer.fullName).toBe('Ana Gomez');
  });

  it.each([
    'productId',
    'quantity',
    'customer',
    'delivery',
    'payment',
    'customer.fullName',
    'customer.email',
    'customer.phone',
    'delivery.addressLine',
    'delivery.city',
    'delivery.region',
    'payment.cardToken',
    'payment.installments',
    'payment.acceptanceToken',
    'payment.personalDataAuthToken',
  ])('rejects a purchase without %s', async (path) => {
    const field = path.split('.').pop()!;

    expect(await errorsFor(without(path))).toContain(`"property":"${field}"`);
  });

  it.each([
    ['productId', 'not-a-uuid'],
    ['quantity', 0],
    ['quantity', 11],
    ['quantity', 1.5],
    ['quantity', '2'],
    ['customer.fullName', 'A'],
    ['customer.email', 'not-an-email'],
    ['customer.phone', '300-123'],
    ['customer.phone', '12345'],
    ['delivery.addressLine', 'x'],
    ['delivery.postalCode', 'x'.repeat(13)],
    ['payment.cardToken', ''],
    ['payment.installments', 0],
    ['payment.installments', 37],
    ['payment.acceptanceToken', 'x'.repeat(4097)],
  ])('rejects %s = %j', async (path, value) => {
    const field = path.split('.').pop()!;

    expect(await errorsFor(withValue(path, value))).toContain(
      `"property":"${field}"`,
    );
  });

  it.each(['cardNumber', 'cvc', 'expMonth', 'amountInCents'])(
    'rejects a field it does not expect (%s), such as card data or an amount',
    async (field) => {
      const body = { ...validBody(), [field]: '4242424242424242' };

      expect(await errorsFor(body)).toContain(`"property":"${field}"`);
    },
  );

  it('rejects card data nested inside payment', async () => {
    expect(
      await errorsFor(withValue('payment.number', '4242424242424242')),
    ).toContain('"property":"number"');
  });
});

describe('QuantityQueryDto', () => {
  const errorsForQuery = async (query: unknown) =>
    JSON.stringify(await validate(plainToInstance(QuantityQueryDto, query)));

  it('reads the quantity from the query string as a number', async () => {
    const dto = plainToInstance(QuantityQueryDto, { quantity: '3' });

    expect(dto.quantity).toBe(3);
    expect(await errorsForQuery({ quantity: '3' })).toBe('[]');
  });

  it.each(['0', '11', 'abc', '1.5', undefined])(
    'rejects quantity = %s',
    async (quantity) => {
      expect(await errorsForQuery({ quantity })).toContain(
        '"property":"quantity"',
      );
    },
  );
});
