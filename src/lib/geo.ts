/**
 * Geographic calculations and distance utilities.
 */

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Converts degrees to radians.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates the great-circle distance between two geographic coordinates using the Haversine formula.
 *
 * @param lat1 - Latitude of first point in decimal degrees (-90 to 90).
 * @param lon1 - Longitude of first point in decimal degrees (-180 to 180).
 * @param lat2 - Latitude of second point in decimal degrees (-90 to 90).
 * @param lon2 - Longitude of second point in decimal degrees (-180 to 180).
 * @returns Spherical distance in kilometers, rounded to 2 decimal places.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const distance = EARTH_RADIUS_KM * c;

  return Number(distance.toFixed(2));
}
