export const getVerifiedProjectCoordinates = (project) => {
  const coordinates = project?.raw?.source_data?.verified_coordinates;
  if (
    coordinates?.verified !== true ||
    typeof coordinates.verified_at !== "string" ||
    !Number.isFinite(Date.parse(coordinates.verified_at)) ||
    typeof coordinates.source !== "string" ||
    !coordinates.source.trim() ||
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude) ||
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) return null;
  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
};

export const toWorldMapPoint = ({ latitude, longitude }) => ({
  x: ((longitude + 180) / 360) * 600,
  y: ((90 - latitude) / 180) * 320,
});
