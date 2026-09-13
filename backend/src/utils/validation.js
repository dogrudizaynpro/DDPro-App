const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeString = (
  value,
  { fieldName, required = false, maxLength = 255 } = {}
) => {
  if (typeof value !== "string") {
    if (required) {
      throw createValidationError(`${fieldName} is required`);
    }
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    if (required) {
      throw createValidationError(`${fieldName} is required`);
    }
    return null;
  }

  if (normalizedValue.length > maxLength) {
    throw createValidationError(
      `${fieldName} must be ${maxLength} characters or fewer`
    );
  }

  return normalizedValue;
};

const normalizeOptionalNumber = (value, { fieldName } = {}) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw createValidationError(`${fieldName} must be a valid number`);
  }

  return amount;
};

const normalizeEnum = (value, allowedValues, fallbackValue) => {
  const normalizedValue = normalizeString(value, {
    fieldName: "Status",
    maxLength: 64,
  });

  if (!normalizedValue) {
    return fallbackValue;
  }

  return allowedValues.includes(normalizedValue)
    ? normalizedValue
    : fallbackValue;
};

export const isValidUuid = (value) =>
  typeof value === "string" && UUID_PATTERN.test(value.trim());

export const validateUuidParam = (value, fieldName = "Resource ID") => {
  if (!isValidUuid(value)) {
    throw createValidationError(`${fieldName} must be a valid UUID`);
  }

  return value.trim();
};

export const getProjectPayload = (body = {}) => ({
  name: normalizeString(body.name || body.title, {
    fieldName: "Project name",
    required: true,
    maxLength: 160,
  }),
  project_type: normalizeString(body.project_type || body.projectType || body.type, {
    fieldName: "Project type",
    maxLength: 120,
  }),
  status: normalizeEnum(
    body.status,
    ["Aktif", "Beklemede", "Tamamlandı", "Taslak"],
    "Taslak"
  ),
  description: normalizeString(body.description, {
    fieldName: "Project description",
    maxLength: 2000,
  }),
});

export const getResearchPayload = (body = {}) => ({
  title: normalizeString(body.title || body.name, {
    fieldName: "Research title",
    required: true,
    maxLength: 160,
  }),
  category: normalizeString(body.category, {
    fieldName: "Research category",
    maxLength: 120,
  }),
  description: normalizeString(body.description || body.note || body.notes, {
    fieldName: "Research description",
    maxLength: 2000,
  }),
  status: normalizeString(body.status, {
    fieldName: "Research status",
    maxLength: 64,
  }),
});

export const getOfferPayload = (body = {}) => {
  const title = normalizeString(body.title || body.name, {
    fieldName: "Offer title",
    required: true,
    maxLength: 160,
  });
  const status = normalizeEnum(
    body.status,
    ["Hazırlanıyor", "Gönderildi", "Onaylandı", "Reddedildi"],
    "Hazırlanıyor"
  );
  const amount = normalizeOptionalNumber(body.amount, {
    fieldName: "Offer amount",
  });
  const currency = normalizeString(body.currency, {
    fieldName: "Currency",
    maxLength: 3,
  });
  const projectId = normalizeString(body.project_id || body.projectId, {
    fieldName: "Project ID",
    maxLength: 64,
  });

  if (projectId && !isValidUuid(projectId)) {
    throw createValidationError("Project ID must be a valid UUID");
  }

  return {
    title,
    amount,
    currency: currency ? currency.toUpperCase() : null,
    status,
    project_id: projectId,
  };
};
