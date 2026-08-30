// ============================================================
// NOT FOUND (404) MIDDLEWARE
// ============================================================
// Handles requests to routes that do not exist.
// Must be used as one of the last middleware in the stack,
// after all other route handlers.
// ============================================================

export const notFound = (req, res, next) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
};

export default notFound;
