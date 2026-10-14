import React from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { OfflineGps } from '../../utils/gps';
import { OfflineAltitude } from '../../utils/altitude';
import {
  Activity,
  Battery,
  Compass,
  Droplets,
  Gauge,
  MapPin,
  Mountain,
  Radio,
  Satellite,
  Thermometer,
  Zap,
} from 'lucide-react';

export const TelemetrySummaryCards: React.FC = () => {
  const { latestTelemetry, connectionState, config, setAltitudeSource } = useTelemetryStore();

  const isConnected = connectionState.isConnected;
  const isStale =
    connectionState.signalStatus === 'NO SIGNAL' ||
    connectionState.signalStatus === 'DISCONNECTED' ||
    connectionState.lastPacketAgeSec > config.packetTimeoutMs / 1000;

  // BME280 Values
  const temp =
    isConnected && latestTelemetry && latestTelemetry.temperature !== null
      ? `${latestTelemetry.temperature.toFixed(1)} °C`
      : '--';

  const hum =
    isConnected &&
    latestTelemetry &&
    latestTelemetry.humidity !== null &&
    latestTelemetry.humidity !== undefined
      ? `${latestTelemetry.humidity.toFixed(1)} %`
      : isConnected && latestTelemetry
      ? 'N/A'
      : '--';

  // DPS310 Values
  const press =
    isConnected && latestTelemetry && latestTelemetry.pressure !== null
      ? `${latestTelemetry.pressure.toFixed(1)} hPa`
      : '--';

  const altitudeAssessment = OfflineAltitude.evaluateAltitude(
    isConnected && latestTelemetry ? latestTelemetry.altitude : null,
    isConnected && latestTelemetry ? latestTelemetry.pressure : null,
    config.referencePressureHpa || 1013.25,
    config.altitudeSource || 'ONBOARD'
  );

  // BMA280 Accelerometer Magnitude |a| = sqrt(ax^2 + ay^2 + az^2)
  const accelMag =
    isConnected && latestTelemetry
      ? Math.sqrt(
          latestTelemetry.ax * latestTelemetry.ax +
            latestTelemetry.ay * latestTelemetry.ay +
            latestTelemetry.az * latestTelemetry.az
        ).toFixed(2)
      : null;

  // Battery
  const batt =
    isConnected && latestTelemetry && latestTelemetry.battery !== null
      ? `${latestTelemetry.battery.toFixed(1)} %`
      : '--';

  // Orientation
  const roll = isConnected && latestTelemetry ? `${latestTelemetry.roll.toFixed(1)}°` : '--';
  const pitch = isConnected && latestTelemetry ? `${latestTelemetry.pitch.toFixed(1)}°` : '--';
  const yaw = isConnected && latestTelemetry ? `${latestTelemetry.yaw.toFixed(1)}°` : '--';

  // Extract last valid GPS and range test state
  const { lastValidGps, rangeTest } = useTelemetryStore();

  const isGpsStale =
    isStale ||
    !lastValidGps ||
    Date.now() - lastValidGps.timestampMs > (config.packetTimeoutMs || 2500);

  const canSatLat =
    isConnected &&
    latestTelemetry &&
    OfflineGps.isValidCoordinate(latestTelemetry.latitude, latestTelemetry.longitude)
      ? latestTelemetry.latitude
      : lastValidGps
      ? lastValidGps.latitude
      : null;

  const canSatLon =
    isConnected &&
    latestTelemetry &&
    OfflineGps.isValidCoordinate(latestTelemetry.latitude, latestTelemetry.longitude)
      ? latestTelemetry.longitude
      : lastValidGps
      ? lastValidGps.longitude
      : null;

  // Offline GPS Distance Calculation
  const gpsAssessment = OfflineGps.computeGpsAssessment(
    config.gsLatitude,
    config.gsLongitude,
    canSatLat,
    canSatLon,
    isGpsStale
  );

  const displayDistanceMeters = rangeTest.currentDistanceMeters ?? gpsAssessment.distanceMeters;
  const formattedDistance = OfflineGps.formatDistance(displayDistanceMeters);

  return (
    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-sky-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            FLIGHT TELEMETRY SUMMARY
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              connectionState.signalStatus === 'RECEIVING'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : connectionState.signalStatus === 'NO SIGNAL'
                ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {connectionState.signalStatus}
          </span>
        </div>
      </div>

      {/* Grid of Telemetry Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {/* 1. DPS310 ALTITUDE */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
              ALTITUDE
            </span>
            <Mountain className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
            {altitudeAssessment.formattedAltitude}
          </div>
          <div className="text-[9px] text-slate-500 flex items-center justify-between mt-0.5 font-mono">
            <span className="truncate">{altitudeAssessment.isEstimated ? 'DPS310 Est' : 'DPS310 Onboard'}</span>
            <button
              onClick={() =>
                setAltitudeSource(
                  config.altitudeSource === 'DPS310_CALCULATED' ? 'ONBOARD' : 'DPS310_CALCULATED'
                )
              }
              title="Click to toggle between Onboard transmitted altitude and local Barometric estimate"
              className="text-[9px] text-sky-600 hover:underline font-sans font-semibold"
            >
              [Switch]
            </button>
          </div>
        </div>

        {/* 2. DPS310 PRESSURE */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
              PRESSURE
            </span>
            <Gauge className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
            {press}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
            DPS310 Sensor
          </div>
        </div>

        {/* 3. BME280 TEMPERATURE */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              TEMP
            </span>
            <Thermometer className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
            {temp}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
            BME280 Temp
          </div>
        </div>

        {/* 4. BME280 RELATIVE HUMIDITY */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">
              HUMIDITY
            </span>
            <Droplets className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
            {hum}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
            BME280 % RH
          </div>
        </div>

        {/* 5. BMA280 ACCELEROMETER */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
              ACCEL |a|
            </span>
            <Activity className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
            {accelMag ? `${accelMag} m/s²` : '--'}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
            {isConnected && latestTelemetry
              ? `X:${latestTelemetry.ax.toFixed(1)} Y:${latestTelemetry.ay.toFixed(1)} Z:${latestTelemetry.az.toFixed(1)}`
              : 'BMA280 3-Axis'}
          </div>
        </div>

        {/* 6. BATTERY */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              BATTERY
            </span>
            <Battery className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
            {batt}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
            Power Bus
          </div>
        </div>

        {/* 7. GPS FIX STATUS */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
              GNSS FIX
            </span>
            <Satellite className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div
            className={`text-base font-black font-mono tracking-tight truncate ${
              gpsAssessment.hasFix
                ? gpsAssessment.isStale
                  ? 'text-amber-600'
                  : 'text-emerald-600'
                : 'text-slate-500'
            }`}
          >
            {gpsAssessment.statusText}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
            {isConnected && latestTelemetry?.gpsSats !== null && latestTelemetry?.gpsSats !== undefined
              ? `${latestTelemetry.gpsSats} Sats in View`
              : 'Offline GNSS'}
          </div>
        </div>

        {/* 8. DISTANCE TO CANSAT */}
        <div className="bg-sky-50/70 p-2 rounded border border-sky-200 hover:border-sky-400 transition-colors">
          <div className="flex items-center justify-between text-sky-700 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              GPS SEPARATION
            </span>
            <MapPin className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 tracking-tight flex items-baseline gap-1">
            <span>{formattedDistance}</span>
            {isGpsStale && displayDistanceMeters !== null && (
              <span className="text-[9px] font-sans font-bold text-amber-600 bg-amber-100 px-1 rounded">
                STALE
              </span>
            )}
          </div>
          <div className="text-[9px] text-sky-600 font-mono mt-0.5 truncate">
            Haversine Geodesic (R = 6,371 km)
          </div>
        </div>

        {/* 9. COMMUNICATION STATUS */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              RF LINK
            </span>
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
            {isConnected ? `${connectionState.packetRate} Hz` : '--'}
          </div>
          <div className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">
            {isConnected && latestTelemetry?.rssi !== null && latestTelemetry?.rssi !== undefined
              ? `RSSI: ${latestTelemetry.rssi} dBm`
              : `Age: ${connectionState.lastPacketAgeSec.toFixed(1)}s`}
          </div>
        </div>
      </div>
    </div>
  );
};
