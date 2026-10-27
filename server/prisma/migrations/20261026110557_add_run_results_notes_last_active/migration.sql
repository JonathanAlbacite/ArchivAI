-- AlterTable
ALTER TABLE `campaignsession` ADD COLUMN `checkpointsReached` INTEGER NULL,
    ADD COLUMN `checkpointsTotal` INTEGER NULL,
    ADD COLUMN `lockResults` JSON NULL,
    ADD COLUMN `mistakes` INTEGER NULL;
