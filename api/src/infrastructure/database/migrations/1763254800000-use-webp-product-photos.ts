import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The catalogue now uses real photos stored as WebP. Only the seeded
 * products are touched; the file name stays the same, the extension changes.
 */
const SEEDED_IDS = [
  'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601',
  'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f602',
  'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f603',
  'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f604',
];

export class UseWebpProductPhotos1763254800000 implements MigrationInterface {
  name = 'UseWebpProductPhotos1763254800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.swapExtension(queryRunner, 'svg', 'webp');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.swapExtension(queryRunner, 'webp', 'svg');
  }

  private async swapExtension(
    queryRunner: QueryRunner,
    from: string,
    to: string,
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE "products"
          SET "image_url" = regexp_replace("image_url", $1, $2)
        WHERE "id" = ANY($3)`,
      [`\\.${from}$`, `.${to}`, SEEDED_IDS],
    );
  }
}
