import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A delivery can now end as CANCELLED, when its payment fails. Deliveries of
 * payments that had already failed were left as PENDING: they are corrected.
 */
export class CancelledDeliveryStatus1763312400000 implements MigrationInterface {
  name = 'CancelledDeliveryStatus1763312400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP CONSTRAINT "ck_deliveries_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD CONSTRAINT "ck_deliveries_status"
         CHECK ("status" IN ('PENDING', 'ASSIGNED', 'CANCELLED'))`,
    );
    await queryRunner.query(
      `UPDATE "deliveries" SET "status" = 'CANCELLED', "updated_at" = now()
        WHERE "status" = 'PENDING'
          AND "transaction_id" IN (
            SELECT "id" FROM "transactions"
             WHERE "status" IN ('DECLINED', 'VOIDED', 'ERROR')
          )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "deliveries" SET "status" = 'PENDING' WHERE "status" = 'CANCELLED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" DROP CONSTRAINT "ck_deliveries_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deliveries" ADD CONSTRAINT "ck_deliveries_status"
         CHECK ("status" IN ('PENDING', 'ASSIGNED'))`,
    );
  }
}
