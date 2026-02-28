const verifyReceptionist = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (!["admin", "doctor", "receptionist"].includes(req.user.role)) return res.status(403).json({ message: "Staff access required" });
  next();
};

export default verifyReceptionist;