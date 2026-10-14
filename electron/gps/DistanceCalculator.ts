/**
 * Offline GPS Distance and Bearing Calculator using Haversine formula
 */
export class DistanceCalculator {
  public static readonly EARTH_RADIUS_METERS = 6371000;

  public static isValidLatitude(lat: number | null | undefined): boolean {
    return (
      lat !== null &&
      lat !== undefined &&
      typeof lat === 'number' &&
      !isNaN(lat) &&
      isFinite(lat) &&
      lat >= -90 &&
      lat <= 90
    );
  }

  public static isValidLongitude(lon: number | null | undefined): boolean {
    return (
      lon !== null &&
      lon !== undefined &&
      typeof lon === 'number' &&
      !isNaN(lon) &&
      isFinite(lon) &&
      lon >= -180 &&
      lon <= 180
    );
  }

  public static isValidCoordinate(
    lat: number | null | undefined,
    lon: number | null | undefined
  ): boolean {
    if (!this.isValidLatitude(lat) || !this.isValidLongitude(lon)) {
      return false;
    }
    if (Math.abs(lat!) < 0.000001 && Math.abs(lon!) < 0.000001) {
      return false;
    }
    return true;
  }

  /**
   * Calculates distance in meters between two lat/lon points
   */
  public static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    if (!this.isValidCoordinate(lat1, lon1) || !this.isValidCoordinate(lat2, lon2)) {
      return 0;
    }

    if (lat1 === lat2 && lon1 === lon2) {
      return 0;
    }

    const R = this.EARTH_RADIUS_METERS; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLonDeg = ((lon2 - lon1 + 540) % 360) - 180;
    const dLon = this.toRadians(dLonDeg);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const clampedA = Math.max(0, Math.min(1, a));
    const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
    return R * c;
  }

  /**
   * Calculates initial bearing in degrees (0-360) from point 1 to point 2
   */
  public static calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    if (!this.isValidCoordinate(lat1, lon1) || !this.isValidCoordinate(lat2, lon2)) {
      return 0;
    }

    if (lat1 === lat2 && lon1 === lon2) {
      return 0;
    }

    const phi1 = this.toRadians(lat1);
    const phi2 = this.toRadians(lat2);
    const dLonDeg = ((lon2 - lon1 + 540) % 360) - 180;
    const deltaLambda = this.toRadians(dLonDeg);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    const theta = Math.atan2(y, x);
    const bearing = (this.toDegrees(theta) + 360) % 360;
    return bearing;
  }

  private static toRadians(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private static toDegrees(rad: number): number {
    return (rad * 180) / Math.PI;
  }
}
