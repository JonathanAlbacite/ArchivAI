-- CreateTable
CREATE TABLE `LessonModule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `extractedText` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'uploaded',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedClue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lessonModuleId` INTEGER NOT NULL,
    `orderNumber` INTEGER NOT NULL,
    `clueText` TEXT NOT NULL,
    `answerText` VARCHAR(191) NOT NULL,
    `scene` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LessonModule` ADD CONSTRAINT `LessonModule_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedClue` ADD CONSTRAINT `GeneratedClue_lessonModuleId_fkey` FOREIGN KEY (`lessonModuleId`) REFERENCES `LessonModule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
