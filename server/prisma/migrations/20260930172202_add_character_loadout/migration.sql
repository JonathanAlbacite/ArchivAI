-- CreateTable
CREATE TABLE `CharacterLoadout` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `headOptionId` VARCHAR(191) NULL,
    `bodyOptionId` VARCHAR(191) NULL,
    `armOptionId` VARCHAR(191) NULL,
    `legOptionId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CharacterLoadout_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CharacterLoadout` ADD CONSTRAINT `CharacterLoadout_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
