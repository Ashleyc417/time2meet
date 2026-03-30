const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1686380866103 {
    name = 'Migration1686380866103';

    async up(queryRunner) {
        // ADD COLUMN IF NOT EXISTS – no-op if Slug already exists (MariaDB 10.0.2+)
        await queryRunner.query(`ALTER TABLE \`Meeting\` ADD COLUMN IF NOT EXISTS \`Slug\` varchar(255)`);
        // Only backfill rows where Slug is still NULL (idempotent)
        await queryRunner.query(`UPDATE \`Meeting\` SET \`Slug\` = CAST(\`ID\` AS char) WHERE \`Slug\` IS NULL`);
        await queryRunner.query(`ALTER TABLE \`Meeting\` MODIFY COLUMN \`Slug\` varchar(255) NOT NULL`);
        // CREATE UNIQUE INDEX IF NOT EXISTS – no-op if the index already exists (MariaDB 10.1.4+)
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS \`IDX_Meeting_Slug\` ON \`Meeting\` (\`Slug\`)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX \`IDX_Meeting_Slug\` ON \`Meeting\``);
        await queryRunner.query(`ALTER TABLE \`Meeting\` DROP COLUMN \`Slug\``);
    }
};
