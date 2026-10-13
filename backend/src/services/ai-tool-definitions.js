export const AI_TOOL_NAMES = Object.freeze({
  readRecords: "read_records",
  prepareWrite: "prepare_write",
});

const operationalResources = [
  "projects",
  "customers",
  "products",
  "systems",
  "price-analysis",
  "material-analysis",
  "procurement",
  "offers",
  "reports",
  "calendar",
];

export const AI_VOICE_TOOL_DEFINITIONS = [
  {
    name: "read_integration_status",
    description: "Read current verified connection and health status for DDPro integrations.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

export const AI_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: AI_TOOL_NAMES.readRecords,
      description: "Read up to 50 current authorized DDPro records. Price analysis returns verified records only.",
      parameters: {
        type: "object",
        properties: {
          resource: { type: "string", enum: operationalResources },
          filters: {
            type: "object",
            properties: {
              id: { type: "string" },
              start: { type: "string" },
              end: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        required: ["resource"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: AI_TOOL_NAMES.prepareWrite,
      description: "Prepare a create, update, or delete. Explicit user confirmation is required before execution.",
      parameters: {
        type: "object",
        properties: {
          resource: { type: "string", enum: operationalResources },
          operation: { type: "string", enum: ["create", "update", "delete"] },
          id: { type: "string" },
          record: { type: "object" },
        },
        required: ["resource", "operation"],
        additionalProperties: false,
      },
    },
  },
];
