import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { OfflineAltitude } from '../../utils/altitude';
import {
  Activity,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Trash2,
  Wind,
  Gauge,
  Compass,
  Radio,
  Satellite,
  Mountain,
} from 'lucide-react';

type TabView = 'COMPONENT' | 'OVERALL' | 'ALL';

export const TelemetryGraphs: React.FC = () => {
  const {
    telemetryHistory,
    isGraphPaused,
    toggleGraphPause,
    clearHistory,
    config,
    connectionState,
    setReferencePressure,
  } = useTelemetryStore();

  const [activeTab, setActiveTab] = useState<TabView>('COMPONENT');
  const [isEditingP0, setIsEditingP0] = useState<boolean>(false);
  const [tempP0, setTempP0] = useState<string>(String(config.referencePressureHpa || 1013.25));

  // Determine if stream is stale
  const isStale =
    connectionState.isConnected &&
    (connectionState.signalStatus === 'NO SIGNAL' ||
      connectionState.lastPacketAgeSec > config.packetTimeoutMs / 1000);

  const hasData = telemetryHistory.length > 0;

  // Extract timestamps
  const timestamps = useMemo(
    () => telemetryHistory.map((t) => t.timestamp || `#${t.packetNumber}`),
    [telemetryHistory]
  );

  // Common Base Options optimized for mission control light theme
  const getBaseOption = (title: string, yUnit: string, yMin?: number, yMax?: number) => ({
    animation: false,
    title: {
      text: title,
      left: '8px',
      top: '4px',
      textStyle: {
        fontSize: 11,
        fontWeight: 700,
        color: '#1e293b',
        fontFamily: 'Segoe UI, Inter, sans-serif',
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      padding: [4, 8],
      textStyle: { color: '#0f172a', fontSize: 11, fontFamily: 'Consolas, monospace' },
    },
    grid: { left: '52px', right: '18px', top: '32px', bottom: '26px' },
    xAxis: {
      type: 'category',
      data: timestamps,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#64748b',
        fontSize: 9,
        fontFamily: 'Consolas, monospace',
        interval: Math.max(1, Math.floor(timestamps.length / 4)),
      },
    },
    yAxis: {
      type: 'value',
      name: yUnit,
      min: yMin,
      max: yMax,
      scale: true,
      nameTextStyle: { color: '#94a3b8', fontSize: 9, padding: [0, 0, 0, 10] },
      splitLine: { lineStyle: { color: '#f1f5f9', width: 1 } },
      axisLine: { show: false },
      axisLabel: { color: '#64748b', fontSize: 9, fontFamily: 'Consolas, monospace' },
    },
  });

  // Dual Y-Axis Base Option
  const getDualAxisOption = (
    title: string,
    leftName: string,
    leftUnit: string,
    rightName: string,
    rightUnit: string
  ) => ({
    animation: false,
    title: {
      text: title,
      left: '8px',
      top: '4px',
      textStyle: {
        fontSize: 11,
        fontWeight: 700,
        color: '#1e293b',
        fontFamily: 'Segoe UI, Inter, sans-serif',
      },
    },
    legend: {
      right: '10px',
      top: '4px',
      itemGap: 8,
      itemWidth: 10,
      itemHeight: 8,
      textStyle: { fontSize: 9, color: '#64748b' },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      padding: [4, 8],
      textStyle: { color: '#0f172a', fontSize: 11, fontFamily: 'Consolas, monospace' },
    },
    grid: { left: '52px', right: '52px', top: '34px', bottom: '26px' },
    xAxis: {
      type: 'category',
      data: timestamps,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#64748b',
        fontSize: 9,
        fontFamily: 'Consolas, monospace',
        interval: Math.max(1, Math.floor(timestamps.length / 4)),
      },
    },
    yAxis: [
      {
        type: 'value',
        name: leftUnit,
        scale: true,
        nameTextStyle: { color: '#64748b', fontSize: 9 },
        splitLine: { lineStyle: { color: '#f1f5f9', width: 1 } },
        axisLine: { show: false },
        axisLabel: { color: '#64748b', fontSize: 9, fontFamily: 'Consolas, monospace' },
      },
      {
        type: 'value',
        name: rightUnit,
        scale: true,
        nameTextStyle: { color: '#64748b', fontSize: 9 },
        splitLine: { show: false },
        axisLine: { show: false },
        axisLabel: { color: '#64748b', fontSize: 9, fontFamily: 'Consolas, monospace' },
      },
    ],
  });

  // ==========================================
  // SECTION A: INDIVIDUAL COMPONENT GRAPHS
  // ==========================================

  // 1. BME280 — Temperature (°C vs. time)
  const bme280TempOption = useMemo(() => {
    const base = getBaseOption('BME280 — TEMPERATURE', '°C');
    return {
      ...base,
      series: [
        {
          name: 'Temperature (°C)',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.temperature),
          lineStyle: { color: '#f59e0b', width: 1.8 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245, 158, 11, 0.18)' },
                { offset: 1, color: 'rgba(245, 158, 11, 0.0)' },
              ],
            },
          },
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 2. BME280 — Humidity (% RH vs. time)
  const bme280HumOption = useMemo(() => {
    const base = getBaseOption('BME280 — RELATIVE HUMIDITY', '% RH', 0, 100);
    const hasAnyHum = telemetryHistory.some((t) => t.humidity !== null && t.humidity !== undefined);
    return {
      ...base,
      series: [
        {
          name: 'Humidity (% RH)',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => (t.humidity !== null && t.humidity !== undefined ? t.humidity : null)),
          lineStyle: { color: '#06b6d4', width: 1.8 },
          areaStyle: hasAnyHum
            ? {
                color: {
                  type: 'linear',
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(6, 182, 212, 0.18)' },
                    { offset: 1, color: 'rgba(6, 182, 212, 0.0)' },
                  ],
                },
              }
            : undefined,
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 3. DPS310 — Atmospheric Pressure (hPa vs. time)
  const dps310PressureOption = useMemo(() => {
    const base = getBaseOption('DPS310 — ATMOSPHERIC PRESSURE', 'hPa');
    return {
      ...base,
      series: [
        {
          name: 'Pressure (hPa)',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.pressure),
          lineStyle: { color: '#10b981', width: 1.8 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.18)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
              ],
            },
          },
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 4. DPS310 — Pressure-Derived Altitude (meters vs. time)
  // Calculates offline barometric estimate h = 44330 * [1 - (P/P0)^0.1903] and displays alongside onboard altitude
  const dps310AltitudeOption = useMemo(() => {
    const p0 = config.referencePressureHpa || 1013.25;
    const base = getBaseOption(`DPS310 — PRESSURE-DERIVED ALTITUDE (P₀=${p0.toFixed(1)} hPa)`, 'm');
    const calculatedAlts = telemetryHistory.map((t) =>
      OfflineAltitude.calculateBarometricAltitude(t.pressure, p0)
    );
    const onboardAlts = telemetryHistory.map((t) => t.altitude);

    return {
      ...base,
      legend: {
        right: '10px',
        top: '4px',
        itemGap: 8,
        itemWidth: 10,
        itemHeight: 8,
        textStyle: { fontSize: 9, color: '#64748b' },
      },
      series: [
        {
          name: 'Barometric Est (Local P₀)',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: calculatedAlts,
          lineStyle: { color: '#0284c7', width: 1.8 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(2, 132, 199, 0.20)' },
                { offset: 1, color: 'rgba(2, 132, 199, 0.0)' },
              ],
            },
          },
        },
        {
          name: 'Onboard Transmitted Alt',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: onboardAlts,
          lineStyle: { color: '#6366f1', width: 1.4, type: 'dashed' },
        },
      ],
    };
  }, [telemetryHistory, timestamps, config.referencePressureHpa]);

  // 5. BMA280 — 3-Axis Accelerometer (AX, AY, AZ in m/s² vs. time)
  const bma280AccelOption = useMemo(() => {
    const base = getBaseOption('BMA280 — 3-AXIS ACCELEROMETER', 'm/s²');
    return {
      ...base,
      legend: {
        right: '10px',
        top: '4px',
        itemGap: 8,
        itemWidth: 10,
        itemHeight: 8,
        textStyle: { fontSize: 9, color: '#64748b' },
      },
      series: [
        {
          name: 'AX (Lateral)',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.ax),
          lineStyle: { color: '#3b82f6', width: 1.4 },
        },
        {
          name: 'AY (Longitudinal)',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.ay),
          lineStyle: { color: '#8b5cf6', width: 1.4 },
        },
        {
          name: 'AZ (Vertical)',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.az),
          lineStyle: { color: '#f43f5e', width: 1.4 },
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 6. GNSS — Numeric GPS Parameters (GPS Altitude & Satellites vs. time)
  const gnssParamsOption = useMemo(() => {
    const base = getDualAxisOption(
      'GNSS — LOCATION & MOVEMENT (GPS ALT & SATELLITES)',
      'GPS Alt',
      'm',
      'Satellites',
      'Sats'
    );
    return {
      ...base,
      series: [
        {
          name: 'GPS Altitude (m)',
          type: 'line',
          yAxisIndex: 0,
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.gpsAltitude),
          lineStyle: { color: '#0ea5e9', width: 1.6 },
        },
        {
          name: 'Satellites',
          type: 'line',
          yAxisIndex: 1,
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.gpsSats),
          lineStyle: { color: '#10b981', width: 1.4, type: 'dotted' },
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // ==========================================
  // SECTION B: OVERALL FLIGHT TELEMETRY GRAPHS
  // ==========================================

  // 1. Overall Flight Altitude Profile (Transmitted Onboard Altitude vs. time)
  const overallAltitudeOption = useMemo(() => {
    const base = getBaseOption('OVERALL FLIGHT ALTITUDE PROFILE', 'm');
    return {
      ...base,
      series: [
        {
          name: 'Flight Altitude',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.altitude),
          lineStyle: { color: '#0284c7', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(2, 132, 199, 0.25)' },
                { offset: 1, color: 'rgba(2, 132, 199, 0.0)' },
              ],
            },
          },
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 2. Environmental Trends (Temp °C and Humidity % RH on Dual Axes)
  const overallEnvTrendOption = useMemo(() => {
    const base = getDualAxisOption(
      'ENVIRONMENTAL TRENDS (TEMP & HUMIDITY)',
      'Temp',
      '°C',
      'Humidity',
      '% RH'
    );
    return {
      ...base,
      series: [
        {
          name: 'Temperature (°C)',
          type: 'line',
          yAxisIndex: 0,
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.temperature),
          lineStyle: { color: '#f59e0b', width: 1.6 },
        },
        {
          name: 'Humidity (% RH)',
          type: 'line',
          yAxisIndex: 1,
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => (t.humidity !== null && t.humidity !== undefined ? t.humidity : null)),
          lineStyle: { color: '#06b6d4', width: 1.6 },
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 3. Atmospheric Pressure Trend (DPS310 hPa)
  const overallPressureTrendOption = useMemo(() => {
    const base = getBaseOption('ATMOSPHERIC PRESSURE TREND (DPS310)', 'hPa');
    return {
      ...base,
      series: [
        {
          name: 'Pressure (hPa)',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.pressure),
          lineStyle: { color: '#10b981', width: 1.8 },
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 4. Three-Axis Acceleration Dynamics (BMA280)
  const overallAccelTrendOption = useMemo(() => {
    const base = getBaseOption('ACCELERATION DYNAMICS (BMA280)', 'm/s²');
    return {
      ...base,
      legend: {
        right: '10px',
        top: '4px',
        itemGap: 8,
        itemWidth: 10,
        itemHeight: 8,
        textStyle: { fontSize: 9, color: '#64748b' },
      },
      series: [
        { name: 'AX', type: 'line', smooth: false, showSymbol: false, data: telemetryHistory.map((t) => t.ax), lineStyle: { color: '#3b82f6', width: 1.4 } },
        { name: 'AY', type: 'line', smooth: false, showSymbol: false, data: telemetryHistory.map((t) => t.ay), lineStyle: { color: '#8b5cf6', width: 1.4 } },
        { name: 'AZ', type: 'line', smooth: false, showSymbol: false, data: telemetryHistory.map((t) => t.az), lineStyle: { color: '#f43f5e', width: 1.4 } },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 5. Attitude Orientation Trends (Roll, Pitch, Yaw in degrees)
  const overallOrientationOption = useMemo(() => {
    const base = getBaseOption('ATTITUDE ANGLES (ROLL / PITCH / YAW)', 'deg');
    return {
      ...base,
      legend: {
        right: '10px',
        top: '4px',
        itemGap: 8,
        itemWidth: 10,
        itemHeight: 8,
        textStyle: { fontSize: 9, color: '#64748b' },
      },
      series: [
        { name: 'Roll', type: 'line', smooth: false, showSymbol: false, data: telemetryHistory.map((t) => t.roll), lineStyle: { color: '#ef4444', width: 1.4 } },
        { name: 'Pitch', type: 'line', smooth: false, showSymbol: false, data: telemetryHistory.map((t) => t.pitch), lineStyle: { color: '#10b981', width: 1.4 } },
        { name: 'Yaw', type: 'line', smooth: false, showSymbol: false, data: telemetryHistory.map((t) => t.yaw), lineStyle: { color: '#6366f1', width: 1.4 } },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 6. Gyroscope Angular Rate Trends (GX, GY, GZ in rad/s)
  const overallGyroOption = useMemo(() => {
    const base = getBaseOption('GYROSCOPIC ANGULAR RATES', 'rad/s');
    return {
      ...base,
      legend: {
        right: '10px',
        top: '4px',
        itemGap: 8,
        itemWidth: 10,
        itemHeight: 8,
        textStyle: { fontSize: 9, color: '#64748b' },
      },
      series: [
        { name: 'GX', type: 'line', smooth: false, showSymbol: false, data: telemetryHistory.map((t) => t.gx), lineStyle: { color: '#06b6d4', width: 1.4 } },
        { name: 'GY', type: 'line', smooth: false, showSymbol: false, data: telemetryHistory.map((t) => t.gy), lineStyle: { color: '#84cc16', width: 1.4 } },
        { name: 'GZ', type: 'line', smooth: false, showSymbol: false, data: telemetryHistory.map((t) => t.gz), lineStyle: { color: '#d97706', width: 1.4 } },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 7. GNSS Speed or GPS Altitude Trend
  const overallGpsDynamicsOption = useMemo(() => {
    const base = getDualAxisOption(
      'GNSS DYNAMICS & FIX STRENGTH',
      'GPS Alt',
      'm',
      'Ground Speed',
      'm/s'
    );
    return {
      ...base,
      series: [
        {
          name: 'GPS Alt (m)',
          type: 'line',
          yAxisIndex: 0,
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.gpsAltitude),
          lineStyle: { color: '#0284c7', width: 1.6 },
        },
        {
          name: 'Ground Speed (m/s)',
          type: 'line',
          yAxisIndex: 1,
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.gpsSpeed),
          lineStyle: { color: '#f59e0b', width: 1.4 },
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // 8. Radio Signal Quality & Link Metrics (RSSI & Packet Rate)
  const overallLinkQualityOption = useMemo(() => {
    const base = getBaseOption('RADIO SIGNAL LINK (RSSI)', 'dBm', -120, 0);
    return {
      ...base,
      series: [
        {
          name: 'RSSI (dBm)',
          type: 'line',
          smooth: false,
          showSymbol: false,
          data: telemetryHistory.map((t) => t.rssi),
          lineStyle: { color: '#8b5cf6', width: 1.8 },
        },
      ],
    };
  }, [telemetryHistory, timestamps]);

  // Handle setting reference pressure P0
  const handleSaveP0 = () => {
    const parsed = parseFloat(tempP0);
    if (!isNaN(parsed) && parsed > 500 && parsed < 1200) {
      setReferencePressure(parsed);
      setIsEditingP0(false);
    } else {
      alert('Please enter a valid atmospheric pressure (500 - 1200 hPa).');
    }
  };

  const handleCalibrateToCurrentPressure = () => {
    const latest = telemetryHistory[telemetryHistory.length - 1];
    if (latest && latest.pressure > 0) {
      const p = parseFloat(latest.pressure.toFixed(2));
      setReferencePressure(p);
      setTempP0(String(p));
      setIsEditingP0(false);
    }
  };

  // Render Graph Card Wrapper with Empty / Stale Status
  const renderGraphCard = (option: any, titleNote?: string) => (
    <div className="relative border border-slate-200 rounded p-1.5 bg-white shadow-2xs hover:border-slate-300 transition-colors w-full min-h-[225px]">
      <ReactECharts
        option={option}
        style={{ height: '215px', width: '100%', minHeight: '215px' }}
        notMerge={false}
        lazyUpdate={true}
      />

      {/* Stale Data Watermark */}
      {isStale && hasData && (
        <div className="absolute top-1 right-2 pointer-events-none">
          <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-50/90 border border-amber-200 px-1 rounded">
            STALE
          </span>
        </div>
      )}

      {/* Empty State Overlay */}
      {!hasData && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[0.5px] flex flex-col items-center justify-center p-2 text-center pointer-events-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            WAITING FOR TELEMETRY
          </span>
          <span className="text-[9px] font-mono text-slate-400 mt-0.5">
            Connect physical USB receiver via COM port
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col w-full">
      {/* Graphs Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {/* Section View Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button
              onClick={() => setActiveTab('COMPONENT')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold tracking-tight transition-all ${
                activeTab === 'COMPONENT'
                  ? 'bg-white text-sky-800 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3 h-3 text-sky-600" />
              <span>INDIVIDUAL COMPONENT TELEMETRY</span>
            </button>

            <button
              onClick={() => setActiveTab('OVERALL')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold tracking-tight transition-all ${
                activeTab === 'OVERALL'
                  ? 'bg-white text-sky-800 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3 h-3 text-emerald-600" />
              <span>OVERALL FLIGHT TELEMETRY</span>
            </button>

            <button
              onClick={() => setActiveTab('ALL')}
              className={`hidden md:flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold tracking-tight transition-all ${
                activeTab === 'ALL'
                  ? 'bg-white text-sky-800 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>ALL</span>
            </button>
          </div>

          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            {telemetryHistory.length} pts
          </span>
        </div>

        {/* Toolbar Controls & P0 Reference Quick Config */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* P0 Reference Quick Button */}
          <div className="relative flex items-center">
            {isEditingP0 ? (
              <div className="flex items-center gap-1 bg-sky-50 border border-sky-300 rounded px-1.5 py-0.5 text-[11px]">
                <span className="text-slate-500 font-bold font-mono">P₀:</span>
                <input
                  type="number"
                  step="0.1"
                  value={tempP0}
                  onChange={(e) => setTempP0(e.target.value)}
                  className="w-16 bg-white border border-slate-300 rounded px-1 py-0.5 text-xs font-mono font-bold text-slate-800"
                />
                <span className="text-slate-400 text-[10px]">hPa</span>
                <button
                  onClick={handleSaveP0}
                  className="px-1.5 py-0.5 bg-sky-600 text-white rounded text-[10px] font-bold"
                >
                  OK
                </button>
                <button
                  onClick={handleCalibrateToCurrentPressure}
                  title="Calibrate P0 to latest measured DPS310 pressure"
                  className="px-1 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                >
                  Zero
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempP0(String(config.referencePressureHpa || 1013.25));
                  setIsEditingP0(true);
                }}
                title="Configurable reference pressure P0 for barometric altitude estimate"
                className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-mono font-semibold border border-slate-300 transition-colors"
              >
                <Sliders className="w-3 h-3 text-sky-600" />
                <span>P₀: {config.referencePressureHpa || 1013.25} hPa</span>
              </button>
            )}
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={toggleGraphPause}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
              isGraphPaused
                ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            {isGraphPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isGraphPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Clear History Button */}
          <button
            onClick={clearHistory}
            className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-semibold border border-slate-300 transition-colors"
          >
            <Trash2 className="w-3 h-3 text-slate-500" />
            <span>CLEAR</span>
          </button>
        </div>
      </div>

      {/* VIEW: SECTION 1 - INDIVIDUAL COMPONENT TELEMETRY */}
      {(activeTab === 'COMPONENT' || activeTab === 'ALL') && (
        <div className="flex flex-col space-y-2 mb-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-600"></span>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Individual Component Telemetry
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              BME280 | DPS310 | BMA280 | GNSS
            </span>
          </div>

          {/* 2-Column Responsive Grid of Individual Component Graphs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* 1. BME280 — Temperature */}
            {renderGraphCard(bme280TempOption)}

            {/* 2. BME280 — Humidity */}
            {renderGraphCard(bme280HumOption)}

            {/* 3. DPS310 — Atmospheric Pressure */}
            {renderGraphCard(dps310PressureOption)}

            {/* 4. DPS310 — Pressure-Derived Altitude */}
            {renderGraphCard(dps310AltitudeOption)}

            {/* 5. BMA280 — 3-Axis Accelerometer */}
            {renderGraphCard(bma280AccelOption)}

            {/* 6. GNSS — Numeric GPS Parameters */}
            {renderGraphCard(gnssParamsOption)}
          </div>
        </div>
      )}

      {/* VIEW: SECTION 2 - OVERALL FLIGHT TELEMETRY */}
      {(activeTab === 'OVERALL' || activeTab === 'ALL') && (
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Overall Flight Telemetry
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Combined Flight Overview & Trends
            </span>
          </div>

          {/* 2-Column Responsive Grid of Overall Flight Graphs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* 1. Overall Altitude Profile */}
            {renderGraphCard(overallAltitudeOption)}

            {/* 2. Temperature and Humidity Environmental Trends */}
            {renderGraphCard(overallEnvTrendOption)}

            {/* 3. Atmospheric Pressure Trend */}
            {renderGraphCard(overallPressureTrendOption)}

            {/* 4. Three-Axis Acceleration Trend */}
            {renderGraphCard(overallAccelTrendOption)}

            {/* 5. Attitude Orientation (Roll, Pitch, Yaw) */}
            {renderGraphCard(overallOrientationOption)}

            {/* 6. Gyroscope Angular Rate Trends */}
            {renderGraphCard(overallGyroOption)}

            {/* 7. GNSS Dynamics & Speed */}
            {renderGraphCard(overallGpsDynamicsOption)}

            {/* 8. Radio Signal Quality & Link Metrics */}
            {renderGraphCard(overallLinkQualityOption)}
          </div>
        </div>
      )}
    </div>
  );
};
