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

export const teacherOnly = (req, res, next) => {
  if (req.user.role !== "TEACHER") {
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