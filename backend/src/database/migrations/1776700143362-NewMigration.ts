import { MigrationInterface, QueryRunner } from "typeorm";

export class NewMigration1776700143362 implements MigrationInterface {
    name = 'NewMigration1776700143362'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clients" ADD "aiProvider" character varying(16) NOT NULL DEFAULT 'gemini'`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "aiModel" character varying(64)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "aiModel"`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "aiProvider"`);
    }

}
