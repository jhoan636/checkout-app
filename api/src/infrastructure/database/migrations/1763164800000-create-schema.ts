import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchema1763164800000 implements MigrationInterface {
  name = 'CreateSchema1763164800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "description" text NOT NULL,
        "price_in_cents" bigint NOT NULL,
        "stock" integer NOT NULL,
        "image_url" varchar(500) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_products" PRIMARY KEY ("id"),
        CONSTRAINT "ck_products_price_positive" CHECK ("price_in_cents" > 0),
        CONSTRAINT "ck_products_stock_not_negative" CHECK ("stock" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "full_name" varchar(120) NOT NULL,
        "email" varchar(254) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_customers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL,
        "reference" varchar(64) NOT NULL,
        "product_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price_in_cents" bigint NOT NULL,
        "base_fee_in_cents" bigint NOT NULL,
        "delivery_fee_in_cents" bigint NOT NULL,
        "amount_in_cents" bigint NOT NULL,
        "currency" char(3) NOT NULL,
        "status" varchar(16) NOT NULL,
        "gateway_transaction_id" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_transactions_reference" UNIQUE ("reference"),
        CONSTRAINT "uq_transactions_gateway_id" UNIQUE ("gateway_transaction_id"),
        CONSTRAINT "fk_transactions_product" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_transactions_customer" FOREIGN KEY ("customer_id")
          REFERENCES "customers" ("id") ON DELETE RESTRICT,
        CONSTRAINT "ck_transactions_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "ck_transactions_amount_positive" CHECK ("amount_in_cents" > 0),
        CONSTRAINT "ck_transactions_fees_not_negative"
          CHECK ("base_fee_in_cents" >= 0 AND "delivery_fee_in_cents" >= 0),
        CONSTRAINT "ck_transactions_status" CHECK (
          "status" IN ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "deliveries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "transaction_id" uuid NOT NULL,
        "address_line" varchar(200) NOT NULL,
        "city" varchar(80) NOT NULL,
        "region" varchar(80) NOT NULL,
        "postal_code" varchar(12),
        "status" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "uq_deliveries_transaction" UNIQUE ("transaction_id"),
        CONSTRAINT "fk_deliveries_transaction" FOREIGN KEY ("transaction_id")
          REFERENCES "transactions" ("id") ON DELETE RESTRICT,
        CONSTRAINT "ck_deliveries_status" CHECK ("status" IN ('PENDING', 'ASSIGNED'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "ix_transactions_status" ON "transactions" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "deliveries"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
