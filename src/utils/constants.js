// ============================================================
// API CONSTANTS AND CONFIGURATION
// ============================================================
// Centralized API configuration and constants
// ============================================================

import { API_BASE_URL } from "../services/api.js";
export { API_BASE_URL };

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// API Error Messages
export const API_ERRORS = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  SERVER_ERROR: "Server error. Please try again later.",
  NOT_FOUND: "Resource not found.",
  UNAUTHORIZED: "Unauthorized access.",
  UNKNOWN_ERROR: "An unknown error occurred.",
};

// ============================================================
// VITE ENVIRONMENT SETUP INSTRUCTIONS
// ============================================================
// To configure the API URL for different environments,
// create a .env.local file in the project root with:
//
// Development:
//   VITE_API_URL=http://localhost:3001
//
// Production:
//   VITE_API_URL=https://api.ddpro.com
//
// Production ortamında VITE_API_URL zorunludur.
// local geliştirmede API service localhost fallback uygular.
// ============================================================
