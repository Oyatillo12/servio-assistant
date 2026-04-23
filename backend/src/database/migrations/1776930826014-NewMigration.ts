import { MigrationInterface, QueryRunner } from 'typeorm';

export class NewMigration1776930826014 implements MigrationInterface {
  name = 'NewMigration1776930826014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" SERIAL NOT NULL, "orderId" integer NOT NULL, "productId" integer NOT NULL, "productName" character varying NOT NULL, "price" numeric(10,2), "quantity" integer NOT NULL, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" SERIAL NOT NULL, "chatId" bigint NOT NULL, "clientId" integer NOT NULL, "phone" character varying NOT NULL, "address" text, "status" character varying(20) NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd88e90eb3227f81feef752cf7" ON "orders" ("chatId", "clientId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "leads" ("id" SERIAL NOT NULL, "chatId" bigint NOT NULL, "clientId" integer NOT NULL, "name" character varying NOT NULL, "phone" character varying NOT NULL, "notes" text, "status" character varying(20) NOT NULL DEFAULT 'new', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_15dc5019feac96abbb1dd3dd05" ON "leads" ("chatId", "clientId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL DEFAULT '', "price" numeric(10,2), "isActive" boolean NOT NULL DEFAULT true, "clientId" integer NOT NULL, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "clients" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "systemPrompt" text NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "type" character varying(10) NOT NULL DEFAULT 'lead', "currency" character varying(3) NOT NULL DEFAULT 'UZS', "adminChatId" bigint, "hasProducts" boolean NOT NULL DEFAULT true, "hasServices" boolean NOT NULL DEFAULT true, "defaultLang" character varying(5) NOT NULL DEFAULT 'uz', "botToken" character varying, "botUsername" character varying, "aiProvider" character varying(16) NOT NULL DEFAULT 'gemini', "aiModel" character varying(64), "botConfig" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_99e921caf21faa2aab020476e44" UNIQUE ("name"), CONSTRAINT "UQ_2a850b0972b11500683fe49b3c4" UNIQUE ("slug"), CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "services" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL DEFAULT '', "price" numeric(10,2), "isActive" boolean NOT NULL DEFAULT true, "clientId" integer NOT NULL, CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_sessions_leadstatus_enum" AS ENUM('cold', 'warm', 'hot', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_sessions" ("id" SERIAL NOT NULL, "chatId" bigint NOT NULL, "clientId" integer NOT NULL, "lang" character varying(5) NOT NULL DEFAULT 'en', "score" integer NOT NULL DEFAULT '0', "leadStatus" "public"."chat_sessions_leadstatus_enum" NOT NULL DEFAULT 'cold', "isAiActive" boolean NOT NULL DEFAULT true, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastMessageAt" TIMESTAMP NOT NULL DEFAULT now(), "recoverySentAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_8e014fe5d8ba422ef82bb8e6217" UNIQUE ("chatId"), CONSTRAINT "PK_efc151a4aafa9a28b73dedc485f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "login" character varying NOT NULL, "email" character varying, "phone" character varying, "password" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'client_admin', "clientId" integer, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2d443082eccd5198f95f2a36e2c" UNIQUE ("login"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_history" ("id" SERIAL NOT NULL, "chatId" bigint NOT NULL, "clientId" integer NOT NULL, "role" character varying(10) NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cf76a7693b0b075dd86ea05f21d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c947a06acecc7b8593b49f0546" ON "chat_history" ("chatId", "clientId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_d2d14dbe199058993e07bdf637a" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD CONSTRAINT "FK_31f2f6cdc217456fc9d0378309d" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "services" DROP CONSTRAINT "FK_31f2f6cdc217456fc9d0378309d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_d2d14dbe199058993e07bdf637a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c947a06acecc7b8593b49f0546"`,
    );
    await queryRunner.query(`DROP TABLE "chat_history"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "chat_sessions"`);
    await queryRunner.query(
      `DROP TYPE "public"."chat_sessions_leadstatus_enum"`,
    );
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP TABLE "clients"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_15dc5019feac96abbb1dd3dd05"`,
    );
    await queryRunner.query(`DROP TABLE "leads"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bd88e90eb3227f81feef752cf7"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
  }
}
