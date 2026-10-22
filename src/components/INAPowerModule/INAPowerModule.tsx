import React, { useState } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { BatteryHealthStatus, SensorStatus } from '../../types/telemetry';
import {
  Activity,
  AlertCircle,
  Battery,
  BatteryCharging,
  BatteryLow,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Gauge,
  Info,
  Sliders,
  Unplug,
  Zap,
} from 'lucide-react';

export const INAPowerModule: React.FC = () => {
  const { latestTelemetry, lastValidIna, connectionState, config, setBatteryProfile } =
    useTelemetryStore();
  const [showDocs, setShowDocs] = useState<boolean>(false);

  const isConnected = connectionState.isConnected;
  const timeoutSec = (config.packetTimeoutMs || 2500) / 1000;
  const isStreamStale =
    !isConnected ||
    connectionState.signalStatus === 'NO SIGNAL' ||
    connectionState.signalStatus === 'DISCONNECTED' ||
    connectionState.lastPacketAgeSec > timeoutSec;

  // Prefer live packet INA values, fallback to cached last valid if within timeout
  const hasLiveIna =
    isConnected &&
    !isStreamStale &&
    latestTelemetry !== null &&
    (latestTelemetry.voltage !== null ||
      latestTelemetry.current !== null ||
      latestTelemetry.power !== null);

  const voltage = hasLiveIna
    ? latestTelemetry!.voltage
    : lastValidIna && isConnected && !isStreamStale
    ? lastValidIna.voltage
    : null;

  const current = hasLiveIna
    ? latestTelemetry!.current
    : lastValidIna && isConnected && !isStreamStale
    ? lastValidIna.current
    : null;

  // Power: use sensor-reported power if valid, else calculate P = V * I if both valid
  let power = hasLiveIna
    ? latestTelemetry!.power
    : lastValidIna && isConnected && !isStreamStale
    ? lastValidIna.power
    : null;

  if (
    (power === null || isNaN(power)) &&
    voltage !== null &&
    !isNaN(voltage) &&
    current !== null &&
    !isNaN(current)
  ) {
    power = parseFloat((voltage * current).toFixed(1));
  }

  const shuntVoltage = hasLiveIna
    ? latestTelemetry!.shuntVoltage
    : lastValidIna && isConnected && !isStreamStale
    ? lastValidIna.shuntVoltage
    : null;

  // Determine Sensor Status: LIVE, DISCONNECTED, or NO DATA
  let sensorStatus: SensorStatus = 'NO DATA';
  if (!isConnected || connectionState.signalStatus === 'DISCONNECTED') {
    sensorStatus = 'DISCONNECTED';
  } else if (hasLiveIna && !isStreamStale) {
    sensorStatus = 'LIVE';
  } else if (isStreamStale) {
    sensorStatus = 'DISCONNECTED';
  } else {
    // Port open, receiving telemetry, but packets contain no INA fields
    sensorStatus = 'NO DATA';
  }

  // Determine Battery Status: NORMAL, LOW, CRITICAL based on configurable thresholds
  const lowThresh = config.batteryLowThresholdVolts ?? 3.5;
  const critThresh = config.batteryCriticalThresholdVolts ?? 3.3;

  let batteryStatus: BatteryHealthStatus = 'UNKNOWN';
  if (voltage !== null && !isNaN(voltage) && sensorStatus === 'LIVE') {
    if (voltage <= critThresh) {
      batteryStatus = 'CRITICAL';
    } else if (voltage <= lowThresh) {
      batteryStatus = 'LOW';
    } else {
      batteryStatus = 'NORMAL';
    }
  }

  // Render Sensor Status Badge
  const renderSensorBadge = () => {
    switch (sensorStatus) {
      case 'LIVE':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>INA SENSOR LIVE</span>
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
            <Unplug className="w-3 h-3 text-slate-400" />
            <span>DISCONNECTED</span>
          </span>
        );
      case 'NO DATA':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>WAITING FOR INA DATA</span>
          </span>
        );
    }
  };

  // Render Battery Status Badge
  const renderBatteryBadge = () => {
    switch (batteryStatus) {
      case 'NORMAL':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>BATTERY NORMAL</span>
          </span>
        );
      case 'LOW':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <BatteryLow className="w-3 h-3 text-amber-600" />
            <span>BATTERY LOW</span>
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>BATTERY CRITICAL</span>
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
            <span>BATTERY: --</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col space-y-3">
      {/* 1. Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-300">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              INA219 / INA226 POWER MONITOR
            </h2>
            <span className="text-[10px] text-slate-500 font-medium block">
              Electrical Power System (EPS) Bus Telemetry
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {renderBatteryBadge()}
          {renderSensorBadge()}
        </div>
      </div>

      {/* 2. Primary Power Metrics Grid (Voltage, Current, Power) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Metric 1: Bus Voltage (V) */}
        <div className="bg-gradient-to-br from-sky-50/70 to-slate-50 p-2.5 rounded-lg border border-sky-200/80 flex flex-col justify-between min-h-[78px]">
          <div className="flex items-center justify-between text-sky-800 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              BUS VOLTAGE
            </span>
            <Gauge className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
            {voltage !== null && !isNaN(voltage) ? `${voltage.toFixed(2)} V` : '--- V'}
          </div>
          <div className="text-[9px] text-slate-500 font-sans flex items-center justify-between mt-0.5">
            <span>Main Supply Rail</span>
            {voltage !== null && (
              <span className="font-mono text-slate-600 font-semibold">
                {voltage >= lowThresh ? 'Nominal' : voltage > critThresh ? 'Warning' : 'Cutoff'}
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Shunt Current (mA) */}
        <div className="bg-gradient-to-br from-amber-50/70 to-slate-50 p-2.5 rounded-lg border border-amber-200/80 flex flex-col justify-between min-h-[78px]">
          <div className="flex items-center justify-between text-amber-800 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              SHUNT CURRENT
            </span>
            <Activity className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
            {current !== null && !isNaN(current) ? `${current.toFixed(1)} mA` : '--- mA'}
          </div>
          <div className="text-[9px] text-slate-500 font-sans flex items-center justify-between mt-0.5">
            <span>Load Current Draw</span>
            {current !== null && (
              <span className="font-mono text-slate-600 font-semibold">
                {(current / 1000).toFixed(3)} A
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Power Consumption (mW) */}
        <div className="bg-gradient-to-br from-emerald-50/70 to-slate-50 p-2.5 rounded-lg border border-emerald-200/80 flex flex-col justify-between min-h-[78px]">
          <div className="flex items-center justify-between text-emerald-800 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              POWER CONSUMPTION
            </span>
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 tracking-tight">
            {power !== null && !isNaN(power) ? `${power.toFixed(1)} mW` : '--- mW'}
          </div>
          <div className="text-[9px] text-slate-500 font-sans flex items-center justify-between mt-0.5">
            <span>P = V × I</span>
            {power !== null && (
              <span className="font-mono text-slate-600 font-semibold">
                {(power / 1000).toFixed(2)} W
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Configurable Battery Chemistry & Thresholds Bar */}
      <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <Battery className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
            Battery Profile:
          </span>
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <button
              onClick={() => setBatteryProfile('1S_LIPO', 3.5, 3.3)}
              className={`px-2 py-0.5 rounded font-sans font-semibold text-[10px] transition-colors ${
                config.batteryProfile === '1S_LIPO' || !config.batteryProfile
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              1S LiPo (3.7V)
            </button>
            <button
              onClick={() => setBatteryProfile('2S_LIPO', 7.0, 6.6)}
              className={`px-2 py-0.5 rounded font-sans font-semibold text-[10px] transition-colors ${
                config.batteryProfile === '2S_LIPO'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              2S LiPo (7.4V)
            </button>
            <button
              onClick={() => setBatteryProfile('5V_BUS', 4.75, 4.5)}
              className={`px-2 py-0.5 rounded font-sans font-semibold text-[10px] transition-colors ${
                config.batteryProfile === '5V_BUS'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              5V Bus
            </button>
          </div>
        </div>

        {/* Current Threshold Limits */}
        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3">
          <span>
            Low: <strong className="text-amber-700">{lowThresh.toFixed(2)}V</strong>
          </span>
          <span>
            Critical: <strong className="text-rose-700">{critThresh.toFixed(2)}V</strong>
          </span>
          {shuntVoltage !== null && (
            <span>
              Shunt Drop: <strong>{shuntVoltage.toFixed(2)} mV</strong>
            </span>
          )}
        </div>
      </div>

      {/* 4. Telemetry Integration Guidance (Expandable when sensor status is NO DATA) */}
      {sensorStatus === 'NO DATA' && (
        <div className="bg-amber-50/70 border border-amber-200 rounded p-2.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-amber-900 font-bold">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>SENSOR DATA UNAVAILABLE: Awaiting INA219 / INA226 Telemetry</span>
            </div>
            <button
              onClick={() => setShowDocs(!showDocs)}
              className="text-[10px] font-sans font-semibold text-amber-800 hover:underline flex items-center gap-0.5"
            >
              <span>{showDocs ? 'Hide Packet Specs' : 'View Packet Specs'}</span>
              {showDocs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          <p className="text-[11px] text-amber-900 leading-relaxed">
            The ground station serial receiver is connected and receiving packets, but incoming telemetry does not yet contain INA power fields.
          </p>

          {showDocs && (
            <div className="mt-2 pt-2 border-t border-amber-200/60 text-[10px] font-mono text-slate-800 space-y-1">
              <p className="font-sans font-semibold text-slate-700">
                To transmit INA219 / INA226 data from your CanSat flight software, include any of the following fields in the serial stream:
              </p>
              <div className="bg-white p-2 rounded border border-amber-200 text-slate-900 overflow-x-auto">
                <code>
                  PKT:42 | ... | VBUS:3.85 V | CURR:142.5 mA | PWR:548.6 mW
                </code>
              </div>
              <p className="text-slate-600 font-sans text-[10px]">
                Supported field aliases:
                <br />
                • Voltage: <code className="bg-amber-100 px-1 rounded">VBUS</code>, <code className="bg-amber-100 px-1 rounded">VOLT</code>, <code className="bg-amber-100 px-1 rounded">VOLTAGE</code>, <code className="bg-amber-100 px-1 rounded">INA_V</code> (units: V)
                <br />
                • Current: <code className="bg-amber-100 px-1 rounded">CURR</code>, <code className="bg-amber-100 px-1 rounded">CURRENT</code>, <code className="bg-amber-100 px-1 rounded">INA_I</code> (units: mA)
                <br />
                • Power: <code className="bg-amber-100 px-1 rounded">PWR</code>, <code className="bg-amber-100 px-1 rounded">POWER</code>, <code className="bg-amber-100 px-1 rounded">INA_P</code> (units: mW, auto-calculated if omitted)
                <br />
                • Multi-line block section header: <code className="bg-amber-100 px-1 rounded">----- INA219 -----</code> or <code className="bg-amber-100 px-1 rounded">----- INA226 -----</code>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
