import { Repository } from 'typeorm';
import { ProductOrmEntity } from '../entities/product.orm-entity';
import { TypeOrmProductRepository } from './typeorm-product.repository';

const row = (overrides: Partial<ProductOrmEntity> = {}): ProductOrmEntity =>
  Object.assign(new ProductOrmEntity(), {
    id: '3f0c2a52-6d0b-4a55-9a5e-0d3b8c1f7a10',
    name: 'Camera drone',
    description: 'Foldable, with a gimbal',
    priceInCents: 25_000_000,
    stock: 5,
    imageUrl: 'https://example.com/drone.png',
    createdAt: new Date('2026-11-14T10:00:00Z'),
    updatedAt: new Date('2026-11-14T10:00:00Z'),
    ...overrides,
  });

const domainProduct = {
  id: '3f0c2a52-6d0b-4a55-9a5e-0d3b8c1f7a10',
  name: 'Camera drone',
  description: 'Foldable, with a gimbal',
  priceInCents: 25_000_000,
  stock: 5,
  imageUrl: 'https://example.com/drone.png',
};

const repositoryWith = (orm: Partial<Repository<ProductOrmEntity>>) =>
  new TypeOrmProductRepository(orm as Repository<ProductOrmEntity>);

describe('TypeOrmProductRepository', () => {
  describe('findAll', () => {
    it('returns domain products ordered by name, without database fields', async () => {
      const find = jest.fn().mockResolvedValue([row()]);

      await expect(repositoryWith({ find }).findAll()).resolves.toEqual([
        domainProduct,
      ]);
      expect(find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    });

    it('returns an empty list when there are no products', async () => {
      const find = jest.fn().mockResolvedValue([]);

      await expect(repositoryWith({ find }).findAll()).resolves.toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the domain product when it exists', async () => {
      const findOneBy = jest.fn().mockResolvedValue(row());

      await expect(
        repositoryWith({ findOneBy }).findById(domainProduct.id),
      ).resolves.toEqual(domainProduct);
      expect(findOneBy).toHaveBeenCalledWith({ id: domainProduct.id });
    });

    it('returns null when it does not exist', async () => {
      const findOneBy = jest.fn().mockResolvedValue(null);

      await expect(
        repositoryWith({ findOneBy }).findById(domainProduct.id),
      ).resolves.toBeNull();
    });

    it('returns null for an id that is not a UUID, without querying', async () => {
      const findOneBy = jest.fn();

      await expect(
        repositoryWith({ findOneBy }).findById('not-a-uuid'),
      ).resolves.toBeNull();
      expect(findOneBy).not.toHaveBeenCalled();
    });
  });
});
