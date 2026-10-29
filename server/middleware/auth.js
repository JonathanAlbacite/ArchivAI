import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Admin is deliberately let through everywhere a teacher is - "Teacher Mode" on the Admin
// dashboard drops the admin account straight into the real teacher UI (room/campaign setup,
// lesson-module generation, the chat assistant) so game setup can be tested end to end without a
// separate teacher account. Ownership checks elsewhere (room.teacherId === req.user.id, etc)
// still scope correctly even for an admin, since whatever they create is owned by their own
// account id like any other teacher's would be.
export const teacherOnly = (req, res, next) => {
  if (req.user.role !== "TEACHER" && req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

export const studentOnly = (req, res, next) => {
  if (req.user.role !== "STUDENT") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

export const adminOnly = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};