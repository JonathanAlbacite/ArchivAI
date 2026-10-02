-- CreateTable
CREATE TABLE `CharacterSet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(191) NOT NULL,
    `glbFilename` VARCHAR(191) NOT NULL,
    `orderNumber` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CharacterSet_glbFilename_key`(`glbFilename`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharacterSetSlot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `characterSetId` INTEGER NOT NULL,
    `slot` VARCHAR(191) NOT NULL,
    `meshName` VARCHAR(191) NOT NULL,
    `optionId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `CharacterSetSlot_optionId_key`(`optionId`),
    UNIQUE INDEX `CharacterSetSlot_characterSetId_slot_key`(`characterSetId`, `slot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CharacterSetSlot` ADD CONSTRAINT `CharacterSetSlot_characterSetId_fkey` FOREIGN KEY (`characterSetId`) REFERENCES `CharacterSet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
