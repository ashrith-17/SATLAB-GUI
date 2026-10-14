import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { OfflineGps } from '../../utils/gps';
import {
  Compass,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Satellite,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export const GPSPanel: React.FC = () => {
  const {
    latestTelemetry,
    lastValidGps,
    rangeTest,
    connectionState,
    config,
    startRangeTest,
    pauseRangeTest,
    resumeRangeTest,
    resetRangeTest,
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

  // Calculate age of latest valid GPS fix
  const gpsFixAgeSec = lastValidGps ? Math.max(0, (now - lastValidGps.timestampMs) / 1000) : null;
  const isGpsStale =
    !isConnected ||
    gpsFixAgeSec === null ||
    gpsFixAgeSec > timeoutSec ||
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

  const displayAlt = hasLiveGps
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

  // Compute offline Haversine distance and bearing
  const gpsAssessment = OfflineGps.computeGpsAssessment(
    config.gsLatitude,
    config.gsLongitude,
    displayLat,
    displayLon,
    isGpsStale
  );

  // Active distance value to display
  const currentDistanceMeters = rangeTest.currentDistanceMeters ?? gpsAssessment.distanceMeters;
  const formattedDistance = OfflineGps.formatDistance(currentDistanceMeters);
  const formattedMaxDistance = OfflineGps.formatDistance(rangeTest.maxDistanceMeters);

  return (
    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col space-y-3">
      {/* Panel Header & Range Test Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-2">
        <div className="flex items-center gap-1.5">
          <Satellite className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            GPS NAVIGATION & RANGE TEST
          </h3>
        </div>

        {/* Range Test Session Controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {rangeTest.isActive ? (
            <>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                  rangeTest.isPaused
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    rangeTest.isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                {rangeTest.isPaused ? 'TEST PAUSED' : 'TEST RUNNING'}
              </span>

              {rangeTest.isPaused ? (
                <button
                  onClick={resumeRangeTest}
                  title="Resume Range Test updates"
                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] flex items-center gap-1 transition-colors"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>RESUME</span>
                </button>
              ) : (
                <button
                  onClick={pauseRangeTest}
                  title="Pause Range Test (freezes max distance tracking)"
                  className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded text-[10px] flex items-center gap-1 transition-colors"
                >
                  <Pause className="w-2.5 h-2.5 fill-current" />
                  <span>PAUSE</span>
                </button>
              )}

              <button
                onClick={resetRangeTest}
                title="Reset Range Test session and clear peak distance"
                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </>
          ) : (
            <button
              onClick={startRangeTest}
              title="Start recording Range Test session and track maximum distance"
              className="px-2.5 py-0.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded text-[10px] flex items-center gap-1 shadow-2xs transition-colors"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>START RANGE TEST</span>
            </button>
          )}
        </div>
      </div>

      {/* GPS Status Row */}
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
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  gpsAssessment.hasCanSatFix
                    ? isGpsStale
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {gpsAssessment.hasCanSatFix
                  ? isGpsStale
                    ? 'STALE FIX'
                    : 'VALID FIX'
                  : 'WAITING FOR FIX'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
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
                {displayAlt !== null && displayAlt !== undefined ? `${displayAlt.toFixed(1)} m` : '--'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">FIX AGE / SPEED</span>
              <span className="font-bold text-slate-800">
                {gpsFixAgeSec !== null ? `${gpsFixAgeSec.toFixed(1)}s` : '--'}
                {displaySpeed !== null && displaySpeed !== undefined
                  ? ` | ${displaySpeed.toFixed(1)} m/s`
                  : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Ground Station Endpoint */}
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              GROUND STATION POSITION
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                gpsAssessment.hasGsFix
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {gpsAssessment.gsStatusText}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">GS LAT</span>
              <span className="font-bold text-slate-800">{config.gsLatitude.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-sans block">GS LON</span>
              <span className="font-bold text-slate-800">{config.gsLongitude.toFixed(6)}</span>
            </div>
          </div>

          {/* Explicit Coordinate Source Disclosure */}
          <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 text-[9px] text-slate-500 font-sans flex items-center gap-1">
            <span className="font-semibold text-slate-600">Coordinate Source:</span>
            <span>Configured Reference Location (No Ground Station GNSS receiver hardware detected)</span>
          </div>
        </div>

        {/* Distance Metrics: Current & Maximum During Test */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* 1. Current GPS Separation */}
          <div className="bg-sky-50 border border-sky-200 p-2 rounded flex flex-col justify-between">
            <div className="flex items-center justify-between text-sky-800 text-[10px] font-bold uppercase mb-0.5">
              <span>GPS SEPARATION</span>
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="flex items-baseline gap-1 my-0.5">
              <div className="text-lg font-black font-mono text-slate-900">
                {formattedDistance}
              </div>
              {isGpsStale && currentDistanceMeters !== null && (
                <span className="text-[8px] font-bold font-sans text-amber-700 bg-amber-100 px-1 py-0.2 rounded">
                  STALE
                </span>
              )}
            </div>
            <span className="text-[8px] text-sky-700/80 font-sans block">
              Haversine (not exact RF range)
            </span>
          </div>

          {/* 2. Maximum Test Distance */}
          <div className="bg-slate-50 border border-slate-200 p-2 rounded flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-700 text-[10px] font-bold uppercase mb-0.5">
              <span>PEAK TEST DISTANCE</span>
              <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-lg font-black font-mono text-slate-900 my-0.5">
              {rangeTest.maxDistanceMeters !== null ? formattedMaxDistance : '--'}
            </div>
            <span className="text-[8px] text-slate-400 font-sans block">
              {rangeTest.isActive
                ? rangeTest.isPaused
                  ? 'Frozen (Paused)'
                  : 'Active Session Peak'
                : 'Session Peak (Start Test to log)'}
            </span>
          </div>

          {/* 3. Bearing */}
          <div className="bg-slate-50 border border-slate-200 p-2 rounded col-span-2 sm:col-span-1 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-700 text-[10px] font-bold uppercase mb-0.5">
              <span>FORWARD AZIMUTH</span>
              <Navigation className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-lg font-black font-mono text-slate-900 my-0.5">
              {gpsAssessment.formattedBearing}
            </div>
            <span className="text-[8px] text-slate-400 font-sans block">
              Bearing GS → CanSat
            </span>
          </div>
        </div>
      </div>

      {/* Communication & Packet Health */}
      <div className="border-t border-slate-100 pt-2 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-slate-400" />
            RF Signal Link:
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

        {/* RSSI & Hardware Note */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
          <div className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-slate-400" />
            <span>RSSI:</span>
            <span className="font-mono font-bold text-slate-700">
              {rssi !== null && rssi !== undefined ? `${rssi} dBm` : '--'}
            </span>
          </div>
          <span className="text-slate-400">Offline Math (R = 6,371 km)</span>
        </div>
      </div>
    </div>
  );
};

