/**
 * Offline GPS Distance and Bearing Utility
 * Uses Haversine spherical trigonometric formula
 * 100% offline, zero internet or external API dependencies
 */

export interface GpsDistanceResult {
  hasFix: boolean;
  hasGsFix: boolean;
  hasCanSatFix: boolean;
  distanceMeters: number | null;
  formattedDistance: string;
  bearingDeg: number | null;
  formattedBearing: string;
  isStale: boolean;
  statusText: string;
  gsStatusText: string;
}

export class OfflineGps {
  public static readonly EARTH_RADIUS_METERS = 6371000;

  /**
   * Validates latitude: must be a finite number within [-90, +90]
   */
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

  /**
   * Validates longitude: must be a finite number within [-180, +180]
   */
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

  /**
   * Validates a lat/lon coordinate pair, rejecting invalid values and Null Island (0,0)
   */
  public static isValidCoordinate(
    lat: number | null | undefined,
    lon: number | null | undefined
  ): boolean {
    if (!this.isValidLatitude(lat) || !this.isValidLongitude(lon)) {
      return false;
    }
    // Reject Null Island (0,0) which indicates uninitialized or missing GPS lock
    if (Math.abs(lat!) < 0.000001 && Math.abs(lon!) < 0.000001) {
      return false;
    }
    return true;
  }

  /**
   * Calculates Haversine geodesic distance in meters between two lat/lon coordinates.
   * Earth radius: 6,371,000 meters.
   * Handles longitude wraparound across the antimeridian (±180°).
   * Returns null if any coordinate is invalid.
   */
  public static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number | null {
    if (!this.isValidCoordinate(lat1, lon1) || !this.isValidCoordinate(lat2, lon2)) {
      return null;
    }

    if (lat1 === lat2 && lon1 === lon2) {
      return 0;
    }

    const phi1 = this.toRadians(lat1);
    const phi2 = this.toRadians(lat2);
    const dLat = this.toRadians(lat2 - lat1);

    // Normalize longitude difference to [-180, +180] degrees to handle antimeridian wraparound
    const dLonDeg = ((lon2 - lon1 + 540) % 360) - 180;
    const dLon = this.toRadians(dLonDeg);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const clampedA = Math.max(0, Math.min(1, a));
    const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
    return this.EARTH_RADIUS_METERS * c;
  }

  /**
   * Calculates initial bearing in degrees (0-360) from point 1 to point 2.
   * Handles longitude wraparound across the antimeridian.
   */
  public static calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number | null {
    if (!this.isValidCoordinate(lat1, lon1) || !this.isValidCoordinate(lat2, lon2)) {
      return null;
    }

    if (lat1 === lat2 && lon1 === lon2) {
      return 0;
    }

    const phi1 = this.toRadians(lat1);
    const phi2 = this.toRadians(lat2);

    // Normalize longitude difference to [-180, +180] degrees
    const dLonDeg = ((lon2 - lon1 + 540) % 360) - 180;
    const dLon = this.toRadians(dLonDeg);

    const y = Math.sin(dLon) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);

    const theta = Math.atan2(y, x);
    const bearing = (this.toDegrees(theta) + 360) % 360;
    return bearing;
  }

  /**
   * Formats distance with metres (m) as the primary unit:
   * - Below 1 km: displayed in meters (e.g. "450 m")
   * - At or above 1 km: displayed in meters with km equivalent (e.g. "1,250 m (1.25 km)")
   */
  public static formatDistance(meters: number | null): string {
    if (meters === null || isNaN(meters)) return '--- m';
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${Math.round(meters).toLocaleString()} m (${(meters / 1000).toFixed(2)} km)`;
  }

  /**
   * Formats distance strictly in metres
   */
  public static formatMetresOnly(meters: number | null): string {
    if (meters === null || isNaN(meters)) return '--- m';
    return `${Math.round(meters).toLocaleString()} m`;
  }

  /**
   * Computes full GPS assessment between Ground Station and CanSat
   */
  public static computeGpsAssessment(
    gsLat: number | null | undefined,
    gsLon: number | null | undefined,
    canSatLat: number | null | undefined,
    canSatLon: number | null | undefined,
    isPacketStale: boolean = false
  ): GpsDistanceResult {
    const hasGsFix = this.isValidCoordinate(gsLat, gsLon);
    const hasCanSatFix = this.isValidCoordinate(canSatLat, canSatLon);

    const gsStatusText = hasGsFix ? 'CONFIGURED REFERENCE' : 'UNCONFIGURED REFERENCE';

    if (!hasGsFix || !hasCanSatFix) {
      return {
        hasFix: false,
        hasGsFix,
        hasCanSatFix,
        distanceMeters: null,
        formattedDistance: '--',
        bearingDeg: null,
        formattedBearing: '--',
        isStale: isPacketStale,
        statusText: !hasCanSatFix ? 'WAITING FOR FIX' : 'NO GS POSITION',
        gsStatusText,
      };
    }

    const dist = this.calculateDistance(gsLat!, gsLon!, canSatLat!, canSatLon!);
    const bearing = this.calculateBearing(gsLat!, gsLon!, canSatLat!, canSatLon!);

    return {
      hasFix: dist !== null,
      hasGsFix: true,
      hasCanSatFix: true,
      distanceMeters: dist,
      formattedDistance: this.formatDistance(dist),
      bearingDeg: bearing,
      formattedBearing: bearing !== null ? `${Math.round(bearing)}°` : '--',
      isStale: isPacketStale,
      statusText: isPacketStale ? 'STALE FIX' : 'FIX',
      gsStatusText,
    };
  }

  private static toRadians(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private static toDegrees(rad: number): number {
    return (rad * 180) / Math.PI;
  }
}
