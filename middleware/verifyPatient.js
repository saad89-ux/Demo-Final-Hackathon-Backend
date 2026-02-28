const verifyPatient = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role !== "patient") return res.status(403).json({ message: "Patient access required" });
  next();
};

export default verifyPatient;