import Busboy from "busboy";
import { MAX_AI_FILE_SIZE } from "../services/ai-file.service.js";

const fail = (message, statusCode = 400) => Object.assign(new Error(message), {
  statusCode,
  expose: true,
});

export const parseAiChatUpload = (req, res, next) => {
  if (!req.is("multipart/form-data")) return next();
  let parser;
  try {
    parser = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fields: 2,
        parts: 4,
        fileSize: MAX_AI_FILE_SIZE,
        fieldSize: 25_000,
      },
    });
  } catch {
    return next(fail("The multipart upload is malformed."));
  }

  const fields = {};
  let file;
  let uploadError;
  parser.on("field", (name, value, info) => {
    if (!["message", "context"].includes(name) || Object.hasOwn(fields, name)) {
      uploadError ||= fail("The upload contains an unexpected or duplicate field.");
      return;
    }
    if (info.valueTruncated) {
      uploadError ||= fail("The message or context is too large.", 413);
      return;
    }
    fields[name] = value;
  });
  parser.on("file", (name, stream, info) => {
    if (name !== "file" || file) {
      uploadError ||= fail("Only one attachment is allowed.");
      stream.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    stream.on("limit", () => {
      uploadError ||= fail("Files must not exceed 10 MB.", 413);
    });
    stream.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_AI_FILE_SIZE) chunks.push(chunk);
    });
    stream.on("error", () => {
      uploadError ||= fail("The file upload was interrupted.");
    });
    stream.on("end", () => {
      file = {
        originalName: info.filename,
        mimeType: info.mimeType,
        buffer: Buffer.concat(chunks, size),
      };
    });
  });
  parser.on("filesLimit", () => { uploadError ||= fail("Only one attachment is allowed."); });
  parser.on("fieldsLimit", () => { uploadError ||= fail("Too many upload fields were sent."); });
  parser.on("partsLimit", () => { uploadError ||= fail("The upload contains too many parts."); });
  parser.on("error", () => { uploadError ||= fail("The multipart upload is malformed."); });
  parser.on("close", () => {
    if (uploadError) return next(uploadError);
    req.body = { ...fields };
    req.aiFile = file;
    return next();
  });
  req.pipe(parser);
};
