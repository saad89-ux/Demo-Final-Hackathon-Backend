export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors.map((err) => ({ field: err.path.join("."), message: err.message })),
      });
    }
  };
};