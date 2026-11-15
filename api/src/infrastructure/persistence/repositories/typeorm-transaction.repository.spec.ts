import {
  DataSource,
  EntityManager,
  MoreThanOrEqual,
  QueryFailedError,
} from 'typeorm';
import { PendingOrder } from '../../../application/ports/transaction.repository';
import { Transaction } from '../../../domain/transaction/transaction';
import { CustomerOrmEntity } from '../entities/customer.orm-entity';
import { DeliveryOrmEntity } from '../entities/delivery.orm-entity';
import { ProductOrmEntity } from '../entities/product.orm-entity';
import { TransactionOrmEntity } from '../entities/transaction.orm-entity';
import { TypeOrmTransactionRepository } from './typeorm-transaction.repository';

const id = '7c1e8a52-6d0b-4a55-9a5e-0d3b8c1f7a10';
const productId = 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601';
const createdAt = new Date('2026-11-15T09:00:00Z');
const resolvedAt = new Date('2026-11-15T09:00:10Z');

const pending: Transaction = {
  id,
  reference: `ORDER-${id}`,
  productId,
  quantity: 2,
  unitPriceInCents: 45_990_000,
  baseFeeInCents: 300_000,
  deliveryFeeInCents: 1_200_000,
  amountInCents: 93_480_000,
  currency: 'COP',
  status: 'PENDING',
  gatewayTransactionId: null,
  createdAt,
  updatedAt: createdAt,
};

const approved: Transaction = {
  ...pending,
  status: 'APPROVED',
  gatewayTransactionId: 'gw-1',
  updatedAt: resolvedAt,
};

const order: PendingOrder = {
  transaction: pending,
  customer: {
    fullName: 'Ana Gomez',
    email: 'ana@example.com',
    phone: '3001234567',
  },
  delivery: {
    addressLine: 'Calle 1 # 2-3',
    city: 'Bogota',
    region: 'Cundinamarca',
    postalCode: null,
  },
};

const affected = (count: number) => ({ affected: count });

const setup = () => {
  const manager = {
    save: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    insert: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(affected(1)),
    decrement: jest.fn().mockResolvedValue(affected(1)),
  };
  const ormRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn().mockResolvedValue(affected(1)),
  };
  const dataSource = {
    transaction: jest.fn((work: (m: EntityManager) => Promise<unknown>) =>
      work(manager as unknown as EntityManager),
    ),
    getRepository: jest.fn().mockReturnValue(ormRepository),
  };
  const repository = new TypeOrmTransactionRepository(
    dataSource as unknown as DataSource,
  );
  return { repository, manager, ormRepository, dataSource };
};

describe('TypeOrmTransactionRepository', () => {
  describe('createPending', () => {
    it('stores customer, transaction and delivery in one database transaction', async () => {
      const { repository, manager, dataSource } = setup();

      await expect(repository.createPending(order)).resolves.toBe('CREATED');

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledWith(
        CustomerOrmEntity,
        order.customer,
      );
      expect(manager.insert).toHaveBeenCalledWith(TransactionOrmEntity, {
        ...pending,
        customerId: 'customer-1',
      });
      expect(manager.insert).toHaveBeenCalledWith(DeliveryOrmEntity, {
        transactionId: id,
        ...order.delivery,
        status: 'PENDING',
      });
    });

    it('lets the failure out so the database rolls everything back', async () => {
      const { repository, manager } = setup();
      manager.insert.mockRejectedValue(new Error('duplicate reference'));

      await expect(repository.createPending(order)).rejects.toThrow(
        'duplicate reference',
      );
    });
  });

  describe('createPending with a repeated id', () => {
    it('reports DUPLICATE instead of failing', async () => {
      const { repository, manager } = setup();
      manager.insert.mockRejectedValue(
        new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('dup'), {
            code: '23505',
          }),
        ),
      );

      await expect(repository.createPending(order)).resolves.toBe('DUPLICATE');
    });

    it('still fails for any other database error', async () => {
      const { repository, manager } = setup();
      manager.insert.mockRejectedValue(
        new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('fk'), {
            code: '23503',
          }),
        ),
      );

      await expect(repository.createPending(order)).rejects.toBeInstanceOf(
        QueryFailedError,
      );
    });
  });

  describe('findOrderById', () => {
    const deliveryRow = Object.assign(new DeliveryOrmEntity(), {
      transactionId: id,
      ...order.delivery,
      status: 'ASSIGNED',
    });
    const transactionRow = Object.assign(new TransactionOrmEntity(), {
      ...approved,
      customerId: 'customer-1',
      customer: Object.assign(new CustomerOrmEntity(), {
        id: 'customer-1',
        ...order.customer,
      }),
    });

    it('returns the transaction with its customer and delivery', async () => {
      const { repository, ormRepository } = setup();
      ormRepository.findOne.mockResolvedValue(transactionRow);
      ormRepository.findOneBy.mockResolvedValue(deliveryRow);

      await expect(repository.findOrderById(id)).resolves.toEqual({
        transaction: approved,
        customer: order.customer,
        delivery: { ...order.delivery, status: 'ASSIGNED' },
      });
      expect(ormRepository.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: { customer: true },
      });
    });

    it('returns null when the transaction does not exist', async () => {
      const { repository, ormRepository } = setup();
      ormRepository.findOne.mockResolvedValue(null);
      ormRepository.findOneBy.mockResolvedValue(null);

      await expect(repository.findOrderById(id)).resolves.toBeNull();
    });

    it('returns null for an id that is not a UUID, without querying', async () => {
      const { repository, ormRepository } = setup();

      await expect(repository.findOrderById('nope')).resolves.toBeNull();
      expect(ormRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('maps the row to a domain transaction', async () => {
      const { repository, ormRepository } = setup();
      ormRepository.findOneBy.mockResolvedValue(
        Object.assign(new TransactionOrmEntity(), {
          ...approved,
          customerId: 'customer-1',
        }),
      );

      await expect(repository.findById(id)).resolves.toEqual(approved);
      expect(ormRepository.findOneBy).toHaveBeenCalledWith({ id });
    });

    it('returns null when it does not exist', async () => {
      const { repository, ormRepository } = setup();
      ormRepository.findOneBy.mockResolvedValue(null);

      await expect(repository.findById(id)).resolves.toBeNull();
    });

    it('returns null for an id that is not a UUID, without querying', async () => {
      const { repository, ormRepository } = setup();

      await expect(repository.findById('nope')).resolves.toBeNull();
      expect(ormRepository.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('findByReference', () => {
    it('maps the row found by its unique reference', async () => {
      const { repository, ormRepository } = setup();
      ormRepository.findOneBy.mockResolvedValue(
        Object.assign(new TransactionOrmEntity(), approved),
      );

      await expect(
        repository.findByReference(approved.reference),
      ).resolves.toEqual(approved);
      expect(ormRepository.findOneBy).toHaveBeenCalledWith({
        reference: approved.reference,
      });
    });

    it('returns null when no transaction has that reference', async () => {
      const { repository, ormRepository } = setup();
      ormRepository.findOneBy.mockResolvedValue(null);

      await expect(repository.findByReference('ORDER-x')).resolves.toBeNull();
    });
  });

  describe('assignGatewayId', () => {
    it('only touches a transaction that is still PENDING', async () => {
      const { repository, ormRepository } = setup();

      await repository.assignGatewayId(id, 'gw-1', resolvedAt);

      expect(ormRepository.update).toHaveBeenCalledWith(
        { id, status: 'PENDING' },
        { gatewayTransactionId: 'gw-1', updatedAt: resolvedAt },
      );
    });
  });

  describe('settle', () => {
    it('changes the status only while the row is still PENDING', async () => {
      const { repository, manager } = setup();

      await repository.settle(approved);

      expect(manager.update).toHaveBeenCalledWith(
        TransactionOrmEntity,
        { id, status: 'PENDING' },
        {
          status: 'APPROVED',
          gatewayTransactionId: 'gw-1',
          updatedAt: resolvedAt,
        },
      );
    });

    it('on approval decreases the stock conditionally and assigns the delivery', async () => {
      const { repository, manager } = setup();

      await expect(repository.settle(approved)).resolves.toBe('SETTLED');

      expect(manager.decrement).toHaveBeenCalledWith(
        ProductOrmEntity,
        { id: productId, stock: MoreThanOrEqual(2) },
        'stock',
        2,
      );
      expect(manager.update).toHaveBeenCalledWith(
        DeliveryOrmEntity,
        { transactionId: id },
        { status: 'ASSIGNED' },
      );
    });

    it('reports ALREADY_FINAL and touches no stock when it lost the race', async () => {
      const { repository, manager } = setup();
      manager.update.mockResolvedValue(affected(0));

      await expect(repository.settle(approved)).resolves.toBe('ALREADY_FINAL');
      expect(manager.decrement).not.toHaveBeenCalled();
    });

    it('does not touch stock or delivery for a declined payment', async () => {
      const { repository, manager } = setup();

      await expect(
        repository.settle({ ...approved, status: 'DECLINED' }),
      ).resolves.toBe('SETTLED');
      expect(manager.decrement).not.toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledTimes(1);
    });

    it('reports APPROVED_WITHOUT_STOCK and leaves the delivery unassigned', async () => {
      const { repository, manager } = setup();
      manager.decrement.mockResolvedValue(affected(0));

      await expect(repository.settle(approved)).resolves.toBe(
        'APPROVED_WITHOUT_STOCK',
      );
      expect(manager.update).toHaveBeenCalledTimes(1);
    });
  });
});
