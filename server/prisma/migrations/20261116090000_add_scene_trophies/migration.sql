-- CreateTable
CREATE TABLE `SceneTrophy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sceneKey` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `src` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SceneTrophy_sceneKey_key`(`sceneKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
