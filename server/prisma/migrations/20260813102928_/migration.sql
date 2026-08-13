/*
  Warnings:

  - A unique constraint covering the columns `[roomId,studentId]` on the table `RoomStudent` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `RoomStudent_roomId_studentId_key` ON `RoomStudent`(`roomId`, `studentId`);
