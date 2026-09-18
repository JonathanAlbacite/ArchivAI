/*
  Warnings:

  - You are about to drop the column `answer` on the `clue` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `clue` DROP COLUMN `answer`,
    ADD COLUMN `note` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('NORMAL', 'MULTICHOICE', 'COMBO') NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE `ClueAnswer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clueId` INTEGER NOT NULL,
    `text` VARCHAR(191) NOT NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,
    `order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VaultTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scene` VARCHAR(191) NOT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VaultTemplate_scene_key`(`scene`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TemplateSlot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `templateId` INTEGER NOT NULL,
    `orderNumber` INTEGER NOT NULL,
    `type` ENUM('NORMAL', 'MULTICHOICE', 'COMBO') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClueAnswer` ADD CONSTRAINT `ClueAnswer_clueId_fkey` FOREIGN KEY (`clueId`) REFERENCES `Clue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TemplateSlot` ADD CONSTRAINT `TemplateSlot_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `VaultTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
