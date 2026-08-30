// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================
// Centralized error handler for Express application.
// Must be used as the last middleware in the stack.
// ============================================================

export const errorHandler = (err, req, res, next) => {
  // Log error safely
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    console.error("Error:", {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode || 500,
    });
  } else {
    console.error("Error:", {
      message: err.message,
      statusCode: err.statusCode || 500,
    });
  }

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Prepare error message
  let errorMessage = "Internal server error";

  if (isDevelopment) {
    // In development, provide more descriptive error messages
    errorMessage = err.message || "Internal server error";
  } else {
    // In production, generic error message
    errorMessage = "Internal server error";
  }

  // Send JSON response
  res.status(statusCode).json({
    status: "error",
    message: errorMessage,
    ...(isDevelopment && { details: err.message }),
  });
};

export default errorHandler;
