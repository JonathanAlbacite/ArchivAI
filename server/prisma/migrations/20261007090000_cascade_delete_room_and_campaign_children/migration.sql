-- Deleting a Room or Campaign now cascades to its dependents at the database
-- level, instead of relying on route handlers to delete children in the
-- right order (all these FKs were previously ON DELETE RESTRICT).

-- DropForeignKey
ALTER TABLE `RoomStudent` DROP FOREIGN KEY `RoomStudent_roomId_fkey`;

-- DropForeignKey
ALTER TABLE `Campaign` DROP FOREIGN KEY `Campaign_roomId_fkey`;

-- DropForeignKey
ALTER TABLE `Clue` DROP FOREIGN KEY `Clue_campaignId_fkey`;

-- DropForeignKey
ALTER TABLE `CampaignSession` DROP FOREIGN KEY `CampaignSession_campaignId_fkey`;

-- DropForeignKey
ALTER TABLE `SessionAttempt` DROP FOREIGN KEY `SessionAttempt_sessionId_fkey`;

-- DropForeignKey
ALTER TABLE `SessionAttempt` DROP FOREIGN KEY `SessionAttempt_clueId_fkey`;

-- AddForeignKey
ALTER TABLE `RoomStudent` ADD CONSTRAINT `RoomStudent_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Clue` ADD CONSTRAINT `Clue_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignSession` ADD CONSTRAINT `CampaignSession_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionAttempt` ADD CONSTRAINT `SessionAttempt_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `CampaignSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SessionAttempt` ADD CONSTRAINT `SessionAttempt_clueId_fkey` FOREIGN KEY (`clueId`) REFERENCES `Clue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE `CampaignProgress` DROP FOREIGN KEY `CampaignProgress_campaignId_fkey`;

-- AddForeignKey
ALTER TABLE `CampaignProgress` ADD CONSTRAINT `CampaignProgress_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
