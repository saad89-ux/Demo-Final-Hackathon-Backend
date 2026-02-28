const verifyDoctor = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (!["admin", "doctor"].includes(req.user.role)) return res.status(403).json({ message: "Doctor or Admin access required" });
  next();
};

export default verifyDoctor;