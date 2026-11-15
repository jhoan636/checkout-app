import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The product the store sells. Its id is fixed so the seed can run on any
 * environment without creating duplicates. The price is in cents of COP.
 */
const PRODUCT = {
  id: 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601',
  name: 'Aurora Wireless Headphones',
  description:
    'Over-ear headphones with active noise cancelling and 40 hours of battery.',
  priceInCents: 45_990_000,
  stock: 12,
  imageUrl: '/products/aurora-headphones.webp',
};

export class SeedProduct1763168400000 implements MigrationInterface {
  name = 'SeedProduct1763168400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Parameters ($1, $2...) keep values out of the SQL text.
    await queryRunner.query(
      `INSERT INTO "products"
         ("id", "name", "description", "price_in_cents", "stock", "image_url")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("id") DO NOTHING`,
      [
        PRODUCT.id,
        PRODUCT.name,
        PRODUCT.description,
        PRODUCT.priceInCents,
        PRODUCT.stock,
        PRODUCT.imageUrl,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "products" WHERE "id" = $1`, [
      PRODUCT.id,
    ]);
  }
}
