import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dummy catalogue. Ids are fixed so the seed can run on any environment
 * without creating duplicates. Prices are in cents of COP.
 */
const PRODUCTS = [
  {
    id: 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601',
    name: 'Aurora Wireless Headphones',
    description:
      'Over-ear headphones with active noise cancelling and 40 hours of battery.',
    priceInCents: 45_990_000,
    stock: 12,
    imageUrl: '/products/aurora-headphones.svg',
  },
  {
    id: 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f602',
    name: 'Nimbus Mechanical Keyboard',
    description:
      'Compact 75% keyboard with hot-swappable switches and warm backlight.',
    priceInCents: 38_950_000,
    stock: 8,
    imageUrl: '/products/nimbus-keyboard.svg',
  },
  {
    id: 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f603',
    name: 'Pulse Smart Watch',
    description: 'Fitness watch with heart rate, GPS and a seven day battery.',
    priceInCents: 62_900_000,
    stock: 5,
    imageUrl: '/products/pulse-watch.svg',
  },
  {
    id: 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f604',
    name: 'Orbit Portable Speaker',
    description:
      'Water resistant speaker with 360 degree sound and 18 hours of playback.',
    priceInCents: 27_900_000,
    stock: 20,
    imageUrl: '/products/orbit-speaker.svg',
  },
];

export class SeedProducts1763168400000 implements MigrationInterface {
  name = 'SeedProducts1763168400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const product of PRODUCTS) {
      // Parameters ($1, $2...) keep values out of the SQL text.
      await queryRunner.query(
        `INSERT INTO "products"
           ("id", "name", "description", "price_in_cents", "stock", "image_url")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("id") DO NOTHING`,
        [
          product.id,
          product.name,
          product.description,
          product.priceInCents,
          product.stock,
          product.imageUrl,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "products" WHERE "id" = ANY($1)`, [
      PRODUCTS.map((product) => product.id),
    ]);
  }
}
