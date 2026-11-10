-- CreateTable
CREATE TABLE `Environment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL DEFAULT 'Sparkles',
    `color` VARCHAR(191) NULL,
    `blurb` VARCHAR(191) NULL,
    `orderNumber` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Environment_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- The environments that exist in the game today. A NULL colour means "use the theme colour".
INSERT INTO `Environment` (`key`, `label`, `icon`, `color`, `blurb`, `orderNumber`, `createdAt`, `updatedAt`) VALUES
    ('library', 'Library', 'BookOpen', NULL, 'A library setting.', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('laboratory', 'Laboratory', 'FlaskConical', NULL, 'A science lab setting.', 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- Tomb is no longer a built-in, but it is kept (so nothing breaks) if a campaign or a question set
-- already uses it. The admin can delete it from the dashboard once nothing does.
INSERT INTO `Environment` (`key`, `label`, `icon`, `color`, `blurb`, `orderNumber`, `createdAt`, `updatedAt`)
SELECT 'tomb', 'Tomb', 'Landmark', NULL, 'An ancient tomb setting.', 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM DUAL
WHERE EXISTS (SELECT 1 FROM `Campaign` WHERE LOWER(`scene`) = 'tomb')
   OR EXISTS (SELECT 1 FROM `VaultTemplate` WHERE `scene` = 'tomb');
