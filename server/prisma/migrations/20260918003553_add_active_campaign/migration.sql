-- AlterTable
ALTER TABLE `room` ADD COLUMN `activeCampaignId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Room` ADD CONSTRAINT `Room_activeCampaignId_fkey` FOREIGN KEY (`activeCampaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
