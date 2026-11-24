-- CreateTable
CREATE TABLE `CampaignRead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaignId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CampaignRead_campaignId_studentId_key`(`campaignId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CampaignRead` ADD CONSTRAINT `CampaignRead_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignRead` ADD CONSTRAINT `CampaignRead_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
