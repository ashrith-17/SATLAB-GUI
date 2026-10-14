/**
 * Offline Barometric Altitude Estimation Utility
 * 
 * Uses the International Standard Atmosphere (ISA) barometric formula:
 * h = 44330 * [1 - (P / P0)^0.1903]
 * 
 * Where:
 * - h is the estimated altitude in metres.
 * - P is the measured atmospheric pressure (hPa) from DPS310.
 * - P0 is the reference pressure at sea-level or ground level (hPa).
 * 
 * Assumptions & Limitations:
 * - Based on standard tropospheric temperature lapse rate of 6.5 K/km and T0 = 288.15 K.
 * - Changes in ambient weather, local temperature, and barometric systems affect accuracy.
 * - For AGL (Above Ground Level) altitude, calibrate P0 to the ground station pressure before flight.
 * - 100% offline, zero network or external dependencies.
 */

export interface AltitudeAssessment {
  estimatedAltitudeMeters: number | null;
  formattedAltitude: string;
  referencePressureHpa: number;
  sourceLabel: string;
  isEstimated: boolean;
}

export class OfflineAltitude {
  public static readonly DEFAULT_SEA_LEVEL_PRESSURE_HPA = 1013.25;

  /**
   * Calculates ISA barometric altitude in meters from measured pressure and reference pressure.
   * Both pressures must be in hPa.
   */
  public static calculateBarometricAltitude(
    pressureHpa: number | null | undefined,
    referencePressureHpa: number = OfflineAltitude.DEFAULT_SEA_LEVEL_PRESSURE_HPA
  ): number | null {
    if (
      pressureHpa === null ||
      pressureHpa === undefined ||
      isNaN(pressureHpa) ||
      pressureHpa <= 0
    ) {
      return null;
    }

    if (
      referencePressureHpa === null ||
      referencePressureHpa === undefined ||
      isNaN(referencePressureHpa) ||
      referencePressureHpa <= 0
    ) {
      referencePressureHpa = OfflineAltitude.DEFAULT_SEA_LEVEL_PRESSURE_HPA;
    }

    // h = 44330 * [1 - (P / P0)^0.1903]
    const ratio = pressureHpa / referencePressureHpa;
    const altitude = 44330 * (1 - Math.pow(ratio, 0.1903));

    return parseFloat(altitude.toFixed(2));
  }

  /**
   * Formats altitude in meters, returning '--' if invalid.
   */
  public static formatAltitude(meters: number | null | undefined): string {
    if (meters === null || meters === undefined || isNaN(meters)) {
      return '--';
    }
    return `${meters.toFixed(1)} m`;
  }

  /**
   * Evaluates the display altitude based on active user selection between
   * onboard transmitted DPS310 altitude and local barometric calculation.
   */
  public static evaluateAltitude(
    onboardAltitudeMeters: number | null | undefined,
    pressureHpa: number | null | undefined,
    referencePressureHpa: number,
    preferredSource: 'ONBOARD' | 'DPS310_CALCULATED' = 'ONBOARD'
  ): AltitudeAssessment {
    const calculated = this.calculateBarometricAltitude(pressureHpa, referencePressureHpa);

    if (preferredSource === 'DPS310_CALCULATED') {
      return {
        estimatedAltitudeMeters: calculated,
        formattedAltitude: this.formatAltitude(calculated),
        referencePressureHpa,
        sourceLabel: `DPS310 Barometric Est. (P₀=${referencePressureHpa.toFixed(1)} hPa)`,
        isEstimated: true,
      };
    }

    // If ONBOARD is preferred, use onboard altitude if valid, else fallback to calculated
    const hasValidOnboard =
      onboardAltitudeMeters !== null &&
      onboardAltitudeMeters !== undefined &&
      !isNaN(onboardAltitudeMeters);

    if (hasValidOnboard) {
      return {
        estimatedAltitudeMeters: onboardAltitudeMeters!,
        formattedAltitude: this.formatAltitude(onboardAltitudeMeters),
        referencePressureHpa,
        sourceLabel: 'DPS310 Onboard Telemetry',
        isEstimated: false,
      };
    }

    return {
      estimatedAltitudeMeters: calculated,
      formattedAltitude: this.formatAltitude(calculated),
      referencePressureHpa,
      sourceLabel: `DPS310 Barometric Est. (P₀=${referencePressureHpa.toFixed(1)} hPa)`,
      isEstimated: true,
    };
  }
}
