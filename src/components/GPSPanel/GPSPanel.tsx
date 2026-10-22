import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { OfflineGps } from '../../utils/gps';
import { FlightSeparation } from '../../utils/flightSeparation';
import {
  ArrowDown,
  ArrowUp,
  Compass,
  MapPin,
  Minus,
  Mountain,
  Navigation,
  Radio,
  RotateCcw,
  Satellite,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';

export const GPSPanel: React.FC = () => {
  const {
    latestTelemetry,
    lastValidGps,
    connectionState,
    config,
    launchAltitudeMeters,
    maxAltitudeMeters,
    recentAltitudes,
    calibrateLaunchReference,
    resetFlightMetrics,
  } = useTelemetryStore();

  const [now, setNow] = useState<number>(Date.now());

  // Periodically update current timestamp for accurate fix age display without triggering full re-renders
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isConnected = connectionState.isConnected;
  const timeoutSec = (config.packetTimeoutMs || 2500) / 1000;

  // Age of latest valid GPS fix
  const gpsFixAgeSec = lastValidGps ? Math.max(0, (now - lastValidGps.timestampMs) / 1000) : null;
  const isGpsStale =
    !isConnected ||
    gpsFixAgeSec === null ||
    gpsFixAgeSec > timeoutSec ||
    connectionState.signalStatus === 'NO SIGNAL' ||
    connectionState.signalStatus === 'DISCONNECTED';

  // Age of general telemetry packets (for altitude stale check)
  const isAltStale =
    !isConnected ||
    connectionState.lastPacketAgeSec > timeoutSec ||
    connectionState.signalStatus === 'NO SIGNAL' ||
    connectionState.signalStatus === 'DISCONNECTED';

  // CanSat coordinates: prefer latest if valid, fallback to cached last valid
  const hasLiveGps =
    isConnected &&
    latestTelemetry !== null &&
    OfflineGps.isValidCoordinate(latestTelemetry.latitude, latestTelemetry.longitude);

  const displayLat = hasLiveGps
    ? latestTelemetry!.latitude
    : lastValidGps
    ? lastValidGps.latitude
    : null;

  const displayLon = hasLiveGps
    ? latestTelemetry!.longitude
    : lastValidGps
    ? lastValidGps.longitude
    : null;

  const displayGpsAlt = hasLiveGps
    ? latestTelemetry!.gpsAltitude
    : lastValidGps
    ? lastValidGps.altitude
    : null;

  const displaySats = hasLiveGps
    ? latestTelemetry!.gpsSats
    : lastValidGps
    ? lastValidGps.sats
    : null;

  const displaySpeed = hasLiveGps
    ? latestTelemetry!.gpsSpeed
    : lastValidGps
    ? lastValidGps.speed
    : null;

  const rssi = isConnected ? latestTelemetry?.rssi : null;

  // Compute live flight separation & ascent/descent summary
  const summary = FlightSeparation.computeSummary({
    gsLatitude: config.gsLatitude,
    gsLongitude: config.gsLongitude,
    gsAltitude: config.gsAltitude,
    canSatLatitude: displayLat,
    canSatLongitude: displayLon,
    onboardAltitudeMeters: isConnected && latestTelemetry ? latestTelemetry.altitude : null,
    pressureHpa: isConnected && latestTelemetry ? latestTelemetry.pressure : null,
    referencePressureHpa: config.referencePressureHpa || 1013.25,
    altitudeSource: config.altitudeSource || 'ONBOARD',
    launchAltitudeMeters,
    maxAltitudeMeters,
    altitudeSamples: recentAltitudes,
    isGpsStale,
    gpsFixAgeSec,
    isAltitudeStale: isAltStale,
  });

  // Render vertical motion badge icon & color
  const renderMotionIcon = () => {
    switch (summary.verticalMotion) {
      case 'ASCENDING':
        return <ArrowUp className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />;
      case 'DESCENDING':
        return <ArrowDown className="w-3.5 h-3.5 text-amber-600 animate-bounce" />;
      case 'STATIONARY':
        return <Minus className="w-3.5 h-3.5 text-slate-500" />;
      case 'WAITING':
      default:
        return <Target className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getMotionStyle = () => {
    switch (summary.verticalMotion) {
      case 'ASCENDING':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'DESCENDING':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'STATIONARY':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'WAITING':
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col space-y-3">
      {/* 1. Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5">
          <Satellite className="w-4 h-4 text-sky-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            GROUND STATION ↔ CANSAT DISTANCE & FLIGHT NAVIGATION
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Launch Altitude Calibration Button */}
          <button
            onClick={calibrateLaunchReference}
            disabled={!isConnected || isAltStale}
            title="Set current altitude as launch point ground reference (AGL zero)"
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold border border-slate-300 disabled:opacity-40 transition-colors"
          >
            Zero Launch Ref
          </button>
          <button
            onClick={resetFlightMetrics}
            title="Reset flight peak altitude and motion history"
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. Prominent Live Ground Distance Display Banner */}
      <div className="bg-gradient-to-r from-sky-50 via-slate-50 to-sky-50/60 p-3 rounded-lg border border-sky-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Main Distance Readout */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              GROUND STATION ↔ CANSAT SEPARATION
            </span>
            <div className="flex items-baseline gap-2 pt-0.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                {summary.hasGpsFix ? summary.formattedGroundDistance : '--- m'}
              </span>
              {isGpsStale && summary.groundDistanceMeters !== null && (
                <span className="text-[9px] font-sans font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                  STALE GPS FIX
                </span>
              )}
            </div>
            <p className="text-[9px] text-slate-500 font-sans">
              Horizontal surface distance (Haversine formula, R = 6,371 km). Not RF range or rocket altitude.
            </p>
          </div>

          {/* GPS Fix Indicator Badge */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                summary.hasGpsFix
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : isGpsStale && summary.groundDistanceMeters !== null
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  summary.hasGpsFix
                    ? 'bg-emerald-500 animate-pulse'
                    : isGpsStale
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
              {summary.hasGpsFix
                ? 'VALID GPS FIX'
                : isGpsStale && summary.groundDistanceMeters !== null
                ? 'STALE GPS FIX'
                : 'WAITING FOR GPS FIX'}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {gpsFixAgeSec !== null ? `Fix Age: ${gpsFixAgeSec.toFixed(1)}s` : 'No Fix'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Ascent & Descent Flight Summary Grid */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
            ASCENT & DESCENT FLIGHT SEPARATION
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Verified Barometric & Geodesic Telemetry
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {/* Metric 1: Ground Distance */}
          <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between min-h-[66px]">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
              Ground Distance
            </span>
            <div className="text-base font-black font-mono text-slate-900 tracking-tight">
              {summary.hasGpsFix ? summary.formattedGroundDistance : '--- m'}
            </div>
            <span className="text-[8px] text-slate-400 font-sans truncate">
              Horizontal separation
            </span>
          </div>

          {/* Metric 2: CanSat Altitude */}
          <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between min-h-[66px]">
            <span className="text-[9px] font-bold text-sky-700 uppercase tracking-wider block">
              CanSat Altitude
            </span>
            <div className="text-base font-black font-mono text-slate-900 tracking-tight">
              {summary.formattedCanSatAltitude}
            </div>
            <span className="text-[8px] text-slate-400 font-sans truncate" title={summary.altitudeSourceLabel}>
              {summary.isAltitudeEstimated ? 'DPS310 Barometric Est.' : 'DPS310 Onboard'}
            </span>
          </div>

          {/* Metric 3: Height Above Launch Point */}
          <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between min-h-[66px]">
            <span className="text-[9px] font-bold text-teal-700 uppercase tracking-wider block">
              Height Above Launch
            </span>
            <div className="text-base font-black font-mono text-slate-900 tracking-tight">
              {summary.formattedHeightAboveLaunch}
            </div>
            <span className="text-[8px] text-slate-400 font-sans truncate">
              {summary.launchAltitudeMeters !== null
                ? `Launch Ref: ${summary.launchAltitudeMeters.toFixed(1)} m`
                : 'Waiting for launch ref'}
            </span>
          </div>

          {/* Metric 4: Maximum Altitude (Apogee) */}
          <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between min-h-[66px]">
            <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider block">
              Maximum Altitude
            </span>
            <div className="text-base font-black font-mono text-slate-900 tracking-tight">
              {summary.formattedMaxAltitude}
            </div>
            <span className="text-[8px] text-slate-400 font-sans truncate">
              Session Peak Apogee
            </span>
          </div>

          {/* Metric 5: 3D Straight-Line Separation */}
          <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between min-h-[66px]">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">
              3D Separation
            </span>
            <div className="text-base font-black font-mono text-slate-900 tracking-tight">
              {summary.formattedThreeDSeparation}
            </div>
            <span className="text-[8px] text-slate-400 font-sans truncate">
              Straight-line slant distance
            </span>
          </div>

          {/* Metric 6: Forward Azimuth / Bearing */}
          <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between min-h-[66px]">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">
              Forward Azimuth
            </span>
            <div className="text-base font-black font-mono text-slate-900 tracking-tight">
              {summary.formattedBearing}
            </div>
            <span className="text-[8px] text-slate-400 font-sans truncate">
              Bearing GS → CanSat
            </span>
          </div>
        </div>

        {/* Flight Movement Banner */}
        <div className={`p-2 rounded border flex items-center justify-between text-xs transition-colors ${getMotionStyle()}`}>
          <div className="flex items-center gap-2">
            {renderMotionIcon()}
            <div>
              <span className="font-bold uppercase tracking-wider text-[10px] mr-1.5">
                Flight Movement:
              </span>
              <span className="font-mono font-bold">{summary.verticalMotionLabel}</span>
            </div>
          </div>
          <span className="text-[9px] font-sans opacity-80">
            {summary.verticalMotion === 'WAITING'
              ? 'Analyzing consecutive altitude measurements'
              : 'Consecutive packet analysis with ±0.5m deadband'}
          </span>
        </div>
      </div>

      {/* 4. GPS Receiver Details & Endpoints */}
      <div className="space-y-2 text-xs">
        {/* CanSat Coordinates Endpoint */}
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  hasLiveGps
                    ? 'bg-sky-500 animate-pulse'
                    : lastValidGps
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
              CANSAT GPS RECEIVER (ONBOARD)
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-500">
                {displaySats !== null && displaySats !== undefined ? `${displaySats} Sats` : '-- Sats'}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                  hasLiveGps
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : isGpsStale && lastValidGps
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}
              >
                {hasLiveGps
                  ? 'VALID FIX'
                  : isGpsStale && lastValidGps
                  ? 'STALE FIX'
                  : 'WAITING FOR FIX'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">LATITUDE</span>
              <span className="font-bold text-slate-900">
                {displayLat !== null && displayLat !== undefined ? displayLat.toFixed(6) : '--'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">LONGITUDE</span>
              <span className="font-bold text-slate-900">
                {displayLon !== null && displayLon !== undefined ? displayLon.toFixed(6) : '--'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">GPS ALTITUDE</span>
              <span className="font-bold text-slate-800">
                {displayGpsAlt !== null && displayGpsAlt !== undefined
                  ? `${displayGpsAlt.toFixed(1)} m`
                  : '--'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">SPEED / FIX AGE</span>
              <span className="font-bold text-slate-800">
                {displaySpeed !== null && displaySpeed !== undefined
                  ? `${displaySpeed.toFixed(1)} m/s`
                  : '--'}
                {gpsFixAgeSec !== null ? ` | ${gpsFixAgeSec.toFixed(1)}s` : ''}
              </span>
            </div>
          </div>
          <div className="mt-1 text-[9px] text-slate-400 font-sans">
            * Note: GPS Altitude is derived from GNSS constellation triangulation and accuracy may vary compared to DPS310 barometric altitude.
          </div>
        </div>

        {/* Ground Station Endpoint */}
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              GROUND STATION REFERENCE POSITION
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              CONFIGURED REFERENCE
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono">
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">GS LAT</span>
              <span className="font-bold text-slate-800">{config.gsLatitude.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">GS LON</span>
              <span className="font-bold text-slate-800">{config.gsLongitude.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">GS ALT (MSL)</span>
              <span className="font-bold text-slate-800">{config.gsAltitude.toFixed(1)} m</span>
            </div>
          </div>

          {/* Coordinate Source Disclosure */}
          <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 text-[9px] text-slate-500 font-sans flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-600">Coordinate Source:</span>
              <span>Configured Reference Location (No Ground Station GNSS receiver hardware detected)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Communication Link & RF Packet Health */}
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            RF Telemetry Link:
          </span>
          <span
            className={`font-bold ${
              connectionState.signalStatus === 'RECEIVING'
                ? 'text-emerald-700'
                : connectionState.signalStatus === 'NO SIGNAL'
                ? 'text-rose-600 animate-pulse'
                : 'text-slate-500'
            }`}
          >
            {connectionState.signalStatus}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
          <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
            <span className="text-[9px] text-slate-400 font-sans block">PACKET AGE</span>
            <span
              className={`text-xs font-bold ${
                connectionState.lastPacketAgeSec > 2 ? 'text-amber-600' : 'text-slate-800'
              }`}
            >
              {connectionState.isConnected ? `${connectionState.lastPacketAgeSec.toFixed(1)} s` : '--'}
            </span>
          </div>

          <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
            <span className="text-[9px] text-slate-400 font-sans block">PACKET RATE</span>
            <span className="text-xs font-bold text-slate-800">
              {connectionState.isConnected ? `${connectionState.packetRate} Hz` : '--'}
            </span>
          </div>

          <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
            <span className="text-[9px] text-slate-400 font-sans block">LOST PKTS</span>
            <span
              className={`text-xs font-bold ${
                connectionState.lostPackets > 0 ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {connectionState.lostPackets}
            </span>
          </div>
        </div>

        {/* RSSI & Geodesic Calculation Note */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
          <div className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-slate-400" />
            <span>Radio RSSI:</span>
            <span className="font-mono font-bold text-slate-700">
              {rssi !== null && rssi !== undefined ? `${rssi} dBm` : '--'}
            </span>
          </div>
          <span className="text-slate-400">Haversine Geodesic (R = 6,371 km)</span>
        </div>
      </div>
    </div>
  );
};
