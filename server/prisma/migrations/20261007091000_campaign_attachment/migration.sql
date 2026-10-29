-- A campaign can now carry one attached resource file (e.g. a handout PDF)
-- that students can view/download alongside it.

-- AlterTable
ALTER TABLE `Campaign` ADD COLUMN `attachmentFilename` VARCHAR(191) NULL,
    ADD COLUMN `attachmentMimeType` VARCHAR(191) NULL,
    ADD COLUMN `attachmentPath` VARCHAR(191) NULL;
