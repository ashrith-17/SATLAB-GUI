/**
 * Flight Separation & Ascent/Descent Evaluation Utility
 * TEAM INDRA CanSat Ground Station
 * 
 * 100% Offline calculations for:
 * 1. Horizontal ground distance (Haversine surface separation)
 * 2. CanSat altitude (onboard or DPS310 pressure-derived)
 * 3. Height above launch point (relative to calibrated launch altitude)
 * 4. Maximum recorded altitude (flight apogee)
 * 5. Vertical motion classification (Ascending / Descending / Stationary)
 *    using consecutive altitude measurements with noise deadband
 * 6. True 3D straight-line separation (when both endpoints have valid horizontal coordinates and altitudes)
 */

import { OfflineGps } from './gps';
import { OfflineAltitude } from './altitude';

export type VerticalMotionState = 'ASCENDING' | 'DESCENDING' | 'STATIONARY' | 'WAITING';

export interface AltitudeSample {
  altitude: number;
  timestampMs: number;
}

export interface FlightSeparationResult {
  // Horizontal separation
  groundDistanceMeters: number | null;
  formattedGroundDistance: string;
  groundDistanceKmText: string | null;

  // Altitude metrics
  canSatAltitudeMeters: number | null;
  formattedCanSatAltitude: string;
  altitudeSourceLabel: string;
  isAltitudeEstimated: boolean;

  // Launch-relative & Apogee
  heightAboveLaunchMeters: number | null;
  formattedHeightAboveLaunch: string;
  launchAltitudeMeters: number | null;

  maxAltitudeMeters: number | null;
  formattedMaxAltitude: string;

  // Vertical motion (consecutive packet analysis)
  verticalMotion: VerticalMotionState;
  verticalMotionLabel: string;
  verticalRateMps: number | null;

  // 3D Separation
  threeDSeparationMeters: number | null;
  formattedThreeDSeparation: string;

  // Azimuth
  bearingDeg: number | null;
  formattedBearing: string;

  // Status flags
  hasGpsFix: boolean;
  isGpsStale: boolean;
  gpsFixAgeSec: number | null;
  isAltitudeStale: boolean;
  groundStationAltitudeMeters: number;
}

export class FlightSeparation {
  /**
   * Formats distance in metres as the primary unit.
   * If distance is >= 1000m, also provides the kilometre equivalent.
   * Example: 125 m -> "125 m"
   * Example: 1250 m -> "1,250 m (1.25 km)"
   */
  public static formatDistance(meters: number | null | undefined): string {
    if (meters === null || meters === undefined || isNaN(meters)) {
      return '--- m';
    }
    const roundedMeters = Math.round(meters);
    if (meters < 1000) {
      return `${roundedMeters} m`;
    }
    const km = (meters / 1000).toFixed(2);
    return `${roundedMeters.toLocaleString()} m (${km} km)`;
  }

  /**
   * Formats distance in metres only
   */
  public static formatMetresOnly(meters: number | null | undefined): string {
    if (meters === null || meters === undefined || isNaN(meters)) {
      return '--- m';
    }
    return `${Math.round(meters).toLocaleString()} m`;
  }

  /**
   * Formats altitude with 1 decimal place
   */
  public static formatAltitude(meters: number | null | undefined): string {
    if (meters === null || meters === undefined || isNaN(meters)) {
      return '--- m';
    }
    return `${meters.toFixed(1)} m`;
  }

  /**
   * Calculates true three-dimensional straight-line separation (Euclidean slant separation)
   * between Ground Station and CanSat.
   * 
   * Strict requirement: Returns null if either ground distance or either endpoint altitude is missing.
   * Never fabricates a 3D distance.
   */
  public static calculate3DSeparation(
    groundDistanceMeters: number | null | undefined,
    canSatAltitudeMeters: number | null | undefined,
    groundStationAltitudeMeters: number | null | undefined
  ): number | null {
    if (
      groundDistanceMeters === null ||
      groundDistanceMeters === undefined ||
      isNaN(groundDistanceMeters) ||
      canSatAltitudeMeters === null ||
      canSatAltitudeMeters === undefined ||
      isNaN(canSatAltitudeMeters) ||
      groundStationAltitudeMeters === null ||
      groundStationAltitudeMeters === undefined ||
      isNaN(groundStationAltitudeMeters)
    ) {
      return null;
    }

    const deltaAlt = canSatAltitudeMeters - groundStationAltitudeMeters;
    const distance3D = Math.sqrt(
      groundDistanceMeters * groundDistanceMeters + deltaAlt * deltaAlt
    );

    return parseFloat(distance3D.toFixed(1));
  }

  /**
   * Evaluates vertical motion (Ascending, Descending, Approximately stationary)
   * based on consecutive altitude samples over a time window.
   * 
   * Strict requirement:
   * - Never classifies motion from a single packet.
   * - Uses consecutive valid samples with a noise deadband tolerance.
   * - Shows 'Waiting for valid telemetry' if samples are insufficient or stale.
   */
  public static evaluateVerticalMotion(
    samples: AltitudeSample[],
    isStale: boolean
  ): {
    state: VerticalMotionState;
    label: string;
    rateMps: number | null;
  } {
    if (isStale || !samples || samples.length < 3) {
      return {
        state: 'WAITING',
        label: 'Waiting for valid telemetry',
        rateMps: null,
      };
    }

    // Sort samples by timestamp
    const sorted = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);
    const newest = sorted[sorted.length - 1];
    const oldest = sorted[0];

    const deltaSec = (newest.timestampMs - oldest.timestampMs) / 1000;
    // Window must span at least 0.4 seconds to prevent division by near-zero jitter
    if (deltaSec < 0.4) {
      return {
        state: 'WAITING',
        label: 'Analyzing consecutive packets...',
        rateMps: null,
      };
    }

    const deltaAlt = newest.altitude - oldest.altitude;
    const rateMps = parseFloat((deltaAlt / deltaSec).toFixed(1));

    // Deadband threshold: altitude change must exceed ±0.5 m AND rate must exceed ±0.3 m/s
    // to reject sensor pressure noise / barometric drift
    if (deltaAlt > 0.5 && rateMps > 0.3) {
      return {
        state: 'ASCENDING',
        label: `Ascending (+${rateMps.toFixed(1)} m/s)`,
        rateMps,
      };
    }

    if (deltaAlt < -0.5 && rateMps < -0.3) {
      return {
        state: 'DESCENDING',
        label: `Descending (${rateMps.toFixed(1)} m/s)`,
        rateMps,
      };
    }

    return {
      state: 'STATIONARY',
      label: `Approximately stationary (${rateMps >= 0 ? '+' : ''}${rateMps.toFixed(1)} m/s)`,
      rateMps,
    };
  }

  /**
   * Computes comprehensive flight separation and ascent/descent summary
   */
  public static computeSummary(params: {
    gsLatitude: number;
    gsLongitude: number;
    gsAltitude: number;
    canSatLatitude: number | null | undefined;
    canSatLongitude: number | null | undefined;
    onboardAltitudeMeters: number | null | undefined;
    pressureHpa: number | null | undefined;
    referencePressureHpa: number;
    altitudeSource: 'ONBOARD' | 'DPS310_CALCULATED';
    launchAltitudeMeters: number | null;
    maxAltitudeMeters: number | null;
    altitudeSamples: AltitudeSample[];
    isGpsStale: boolean;
    gpsFixAgeSec: number | null;
    isAltitudeStale: boolean;
  }): FlightSeparationResult {
    const {
      gsLatitude,
      gsLongitude,
      gsAltitude,
      canSatLatitude,
      canSatLongitude,
      onboardAltitudeMeters,
      pressureHpa,
      referencePressureHpa,
      altitudeSource,
      launchAltitudeMeters,
      maxAltitudeMeters,
      altitudeSamples,
      isGpsStale,
      gpsFixAgeSec,
      isAltitudeStale,
    } = params;

    // 1. Horizontal Ground Distance (Haversine)
    const hasGsCoords = OfflineGps.isValidCoordinate(gsLatitude, gsLongitude);
    const hasCanSatCoords = OfflineGps.isValidCoordinate(canSatLatitude, canSatLongitude);
    const hasGpsFix = hasGsCoords && hasCanSatCoords && !isGpsStale;

    let groundDistanceMeters: number | null = null;
    let bearingDeg: number | null = null;

    if (hasGsCoords && hasCanSatCoords) {
      groundDistanceMeters = OfflineGps.calculateDistance(
        gsLatitude,
        gsLongitude,
        canSatLatitude!,
        canSatLongitude!
      );
      bearingDeg = OfflineGps.calculateBearing(
        gsLatitude,
        gsLongitude,
        canSatLatitude!,
        canSatLongitude!
      );
    }

    const formattedGroundDistance = hasGpsFix
      ? this.formatDistance(groundDistanceMeters)
      : isGpsStale && groundDistanceMeters !== null
      ? `${this.formatDistance(groundDistanceMeters)} (Stale)`
      : '--- m';

    const groundDistanceKmText =
      groundDistanceMeters !== null && groundDistanceMeters >= 1000
        ? `${(groundDistanceMeters / 1000).toFixed(2)} km`
        : null;

    // 2. CanSat Altitude (Evaluated from verified source: onboard or DPS310 pressure calculation)
    const altitudeEval = OfflineAltitude.evaluateAltitude(
      onboardAltitudeMeters,
      pressureHpa,
      referencePressureHpa,
      altitudeSource
    );

    const canSatAltitudeMeters = isAltitudeStale ? null : altitudeEval.estimatedAltitudeMeters;
    const formattedCanSatAltitude = this.formatAltitude(canSatAltitudeMeters);

    // 3. Height Above Launch Point
    let heightAboveLaunchMeters: number | null = null;
    if (canSatAltitudeMeters !== null && launchAltitudeMeters !== null) {
      heightAboveLaunchMeters = parseFloat(
        (canSatAltitudeMeters - launchAltitudeMeters).toFixed(1)
      );
    }
    const formattedHeightAboveLaunch =
      heightAboveLaunchMeters !== null
        ? `${heightAboveLaunchMeters >= 0 ? '+' : ''}${heightAboveLaunchMeters.toFixed(1)} m`
        : '--- m';

    // 4. Maximum Recorded Altitude (Apogee)
    const formattedMaxAltitude = this.formatAltitude(maxAltitudeMeters);

    // 5. Vertical Motion (consecutive measurements)
    const motion = this.evaluateVerticalMotion(altitudeSamples, isAltitudeStale);

    // 6. Optional True 3D Straight-Line Separation
    const threeDSeparationMeters =
      hasGpsFix && canSatAltitudeMeters !== null && !isAltitudeStale
        ? this.calculate3DSeparation(groundDistanceMeters, canSatAltitudeMeters, gsAltitude)
        : null;

    const formattedThreeDSeparation = this.formatDistance(threeDSeparationMeters);

    // 7. Bearing formatted
    const formattedBearing =
      bearingDeg !== null ? `${Math.round(bearingDeg)}°` : '---°';

    return {
      groundDistanceMeters,
      formattedGroundDistance,
      groundDistanceKmText,

      canSatAltitudeMeters,
      formattedCanSatAltitude,
      altitudeSourceLabel: altitudeEval.sourceLabel,
      isAltitudeEstimated: altitudeEval.isEstimated,

      heightAboveLaunchMeters,
      formattedHeightAboveLaunch,
      launchAltitudeMeters,

      maxAltitudeMeters,
      formattedMaxAltitude,

      verticalMotion: motion.state,
      verticalMotionLabel: motion.label,
      verticalRateMps: motion.rateMps,

      threeDSeparationMeters,
      formattedThreeDSeparation,

      bearingDeg,
      formattedBearing,

      hasGpsFix,
      isGpsStale,
      gpsFixAgeSec,
      isAltitudeStale,
      groundStationAltitudeMeters: gsAltitude,
    };
  }
}
