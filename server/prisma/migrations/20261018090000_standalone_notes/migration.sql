-- Additional notes (standalone hints): the admin sets how many each vault's campaigns
-- must have, and each campaign stores its own notes.

-- AlterTable
ALTER TABLE `VaultTemplate` ADD COLUMN `standaloneNoteCount` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `StandaloneNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaignId` INTEGER NOT NULL,
    `orderNumber` INTEGER NOT NULL,
    `text` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StandaloneNote` ADD CONSTRAINT `StandaloneNote_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
