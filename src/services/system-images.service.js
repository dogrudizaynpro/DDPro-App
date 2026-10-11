import { fetchAPI } from "./api.js";

const pathFor = (systemId, imageId) => {
  const path = `/api/systems/${encodeURIComponent(systemId)}/images`;
  return imageId ? `${path}/${encodeURIComponent(imageId)}` : path;
};

const fileEndpoint = (systemId, file, imageId) => {
  const query = new URLSearchParams({ name: file.name });
  return `${pathFor(systemId, imageId)}?${query.toString()}`;
};

export const getSystemImages = async (systemId) => {
  const response = await fetchAPI(pathFor(systemId));
  if (!Array.isArray(response?.data)) throw new Error("Sistem görselleri için backend yanıtı geçersiz.");
  return response.data;
};

export const uploadSystemImage = async (systemId, file) => {
  const response = await fetchAPI(fileEndpoint(systemId, file), {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  return response.data;
};

export const replaceSystemImage = async (systemId, imageId, file) => {
  const response = await fetchAPI(fileEndpoint(systemId, file, imageId), {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  return response.data;
};

export const deleteSystemImage = async (systemId, imageId) => {
  const response = await fetchAPI(pathFor(systemId, imageId), { method: "DELETE" });
  return response.data;
};
