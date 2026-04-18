import { MigrationInterface, QueryRunner } from "typeorm";

export class NewMigration1776543827601 implements MigrationInterface {
    name = 'NewMigration1776543827601'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clients" ADD "currency" character varying(3) NOT NULL DEFAULT 'USD'`);
        await queryRunner.query(`ALTER TABLE "services" ADD "price" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "services" DROP COLUMN "price"`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "currency"`);
    }

}
