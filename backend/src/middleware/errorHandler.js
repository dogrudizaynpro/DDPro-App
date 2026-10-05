// ============================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================
// Centralized error handler for Express application.
// Must be used as the last middleware in the stack.
// ============================================================

export const errorHandler = (err, req, res, next) => {
  // Log error safely
  const isDevelopment = process.env.NODE_ENV === "development";

  if (err.googleApiError) {
    console.error("Google API error:", {
      upstreamStatus: err.googleApiError.httpStatus,
      category: err.googleApiError.category,
    });
  } else if (isDevelopment) {
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
    errorMessage = err.expose ? err.message : "Internal server error";
  }

  // Send JSON response
  res.status(statusCode).json({
    status: "error",
    message: errorMessage,
    ...(err.googleApiError && {
      code: err.code,
      provider: err.provider,
      upstreamStatus: err.upstreamStatus,
      googleApiError: err.googleApiError,
    }),
    ...(isDevelopment && { details: err.message }),
  });
};

export default errorHandler;
