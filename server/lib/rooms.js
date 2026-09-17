import prisma from "./prisma.js";

const generateRoomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Creates a Room for the given teacher with a freshly generated, unique
// roomCode. Shared by the REST room-creation route and the teacher chatbot's
// create_room tool so both mint codes the same way.
export const createRoomForTeacher = async (teacherId, { name, description }) => {
  let roomCode;
  let exists = true;

  while (exists) {
    roomCode = generateRoomCode();
    const found = await prisma.room.findUnique({ where: { roomCode } });
    exists = !!found;
  }

  return prisma.room.create({
    data: { name, description, roomCode, teacherId },
  });
};
