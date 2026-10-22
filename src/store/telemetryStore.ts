import { create } from 'zustand';
import {
  CommandItem,
  CommandLog,
  ConnectionState,
  GroundStationConfig,
  SerialPortInfo,
  TelemetryData,
} from '../types/telemetry';
import { OfflineGps } from '../utils/gps';
import { OfflineAltitude } from '../utils/altitude';
import { AltitudeSample } from '../utils/flightSeparation';

export interface LastValidGps {
  latitude: number;
  longitude: number;
  altitude: number | null;
  sats: number | null;
  speed: number | null;
  timestampMs: number;
}

export interface LastValidIna {
  voltage: number | null;
  current: number | null;
  power: number | null;
  shuntVoltage: number | null;
  timestampMs: number;
}

interface TelemetryState {
  // Connection & System
  connectionState: ConnectionState;
  availablePorts: SerialPortInfo[];
  config: GroundStationConfig;

  // Real-time Data
  latestTelemetry: TelemetryData | null;
  telemetryHistory: TelemetryData[];
  rawLogLines: string[];
  systemLogs: string[];
  commandLogs: CommandLog[];
  predefinedCommands: CommandItem[];

  // GPS & Live Distance
  lastValidGps: LastValidGps | null;
  liveDistanceMeters: number | null;

  // INA Power Monitoring
  lastValidIna: LastValidIna | null;

  // Flight Ascent / Descent Metrics
  launchAltitudeMeters: number | null;
  maxAltitudeMeters: number | null;
  recentAltitudes: AltitudeSample[];

  // Graph & UI Toggles
  isGraphPaused: boolean;
  isRawLogPaused: boolean;

  // Actions
  setConnectionState: (state: ConnectionState) => void;
  setAvailablePorts: (ports: SerialPortInfo[]) => void;
  setConfig: (config: GroundStationConfig) => void;
  setReferencePressure: (p0: number) => void;
  setAltitudeSource: (source: 'ONBOARD' | 'DPS310_CALCULATED') => void;
  setBatteryProfile: (
    profile: '1S_LIPO' | '2S_LIPO' | '5V_BUS' | 'CUSTOM',
    lowV?: number,
    critV?: number
  ) => void;
  setPredefinedCommands: (cmds: CommandItem[]) => void;
  addTelemetry: (data: TelemetryData) => void;
  addRawLine: (line: string) => void;
  addSystemLog: (msg: string) => void;
  addCommandLog: (log: CommandLog) => void;
  updateCommandLog: (log: CommandLog) => void;
  toggleGraphPause: () => void;
  toggleRawLogPause: () => void;
  clearHistory: () => void;
  clearRawLog: () => void;

  // Flight & Launch Calibration Actions
  setLaunchAltitude: (alt: number | null) => void;
  calibrateLaunchReference: () => void;
  resetFlightMetrics: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  connectionState: {
    status: 'DISCONNECTED',
    isConnected: false,
    port: 'Disconnected',
    baudRate: 115200,
    packetRate: 0,
    totalPackets: 0,
    lostPackets: 0,
    lastPacketAgeSec: 0,
    signalStatus: 'DISCONNECTED',
    totalBytesReceived: 0,
    lastPacketTimestamp: null,
    parseErrorCount: 0,
    lastError: null,
    lastErrorInstruction: null,
  },
  availablePorts: [],
  config: {
    gsLatitude: 12.9716,
    gsLongitude: 77.5946,
    gsAltitude: 920.0,
    defaultBaudRate: 115200,
    packetTimeoutMs: 2500,
    maxGraphPoints: 500,
    parserDelimiter: '|',
    referencePressureHpa: 1013.25,
    altitudeSource: 'ONBOARD',
    batteryProfile: '1S_LIPO',
    batteryLowThresholdVolts: 3.5,
    batteryCriticalThresholdVolts: 3.3,
    customCommands: [],
  },

  latestTelemetry: null,
  telemetryHistory: [],
  rawLogLines: [],
  systemLogs: [],
  commandLogs: [],
  predefinedCommands: [],

  lastValidGps: null,
  liveDistanceMeters: null,

  lastValidIna: null,

  launchAltitudeMeters: null,
  maxAltitudeMeters: null,
  recentAltitudes: [],

  isGraphPaused: false,
  isRawLogPaused: false,

  setConnectionState: (state) => set({ connectionState: state }),
  setAvailablePorts: (ports) => set({ availablePorts: ports }),
  setConfig: (config) => {
    set((state) => {
      let currentDist = state.liveDistanceMeters;
      if (
        state.lastValidGps &&
        OfflineGps.isValidCoordinate(config.gsLatitude, config.gsLongitude)
      ) {
        currentDist = OfflineGps.calculateDistance(
          config.gsLatitude,
          config.gsLongitude,
          state.lastValidGps.latitude,
          state.lastValidGps.longitude
        );
      }
      return {
        config,
        liveDistanceMeters: currentDist,
      };
    });
  },
  setReferencePressure: (p0) =>
    set((state) => ({
      config: { ...state.config, referencePressureHpa: p0 },
    })),
  setAltitudeSource: (source) =>
    set((state) => ({
      config: { ...state.config, altitudeSource: source },
    })),
  setBatteryProfile: (profile, lowV, critV) =>
    set((state) => {
      let defLow = lowV;
      let defCrit = critV;
      if (defLow === undefined || defCrit === undefined) {
        if (profile === '1S_LIPO') {
          defLow = 3.5;
          defCrit = 3.3;
        } else if (profile === '2S_LIPO') {
          defLow = 7.0;
          defCrit = 6.6;
        } else if (profile === '5V_BUS') {
          defLow = 4.75;
          defCrit = 4.5;
        } else {
          defLow = state.config.batteryLowThresholdVolts || 3.5;
          defCrit = state.config.batteryCriticalThresholdVolts || 3.3;
        }
      }
      return {
        config: {
          ...state.config,
          batteryProfile: profile,
          batteryLowThresholdVolts: defLow,
          batteryCriticalThresholdVolts: defCrit,
        },
      };
    }),
  setPredefinedCommands: (cmds) => set({ predefinedCommands: cmds }),

  addTelemetry: (data) => {
    set((state) => {
      const maxPts = state.config.maxGraphPoints || 500;
      let history = state.telemetryHistory;
      if (!state.isGraphPaused) {
        history = [...state.telemetryHistory, data];
        if (history.length > maxPts) {
          history.shift();
        }
      }

      // Check for valid GPS coordinates
      let newLastValidGps = state.lastValidGps;
      let newLiveDist = state.liveDistanceMeters;

      if (OfflineGps.isValidCoordinate(data.latitude, data.longitude)) {
        newLastValidGps = {
          latitude: data.latitude!,
          longitude: data.longitude!,
          altitude: data.gpsAltitude,
          sats: data.gpsSats,
          speed: data.gpsSpeed,
          timestampMs: Date.now(),
        };

        // Calculate horizontal ground distance if GS coordinates are valid
        if (OfflineGps.isValidCoordinate(state.config.gsLatitude, state.config.gsLongitude)) {
          const dist = OfflineGps.calculateDistance(
            state.config.gsLatitude,
            state.config.gsLongitude,
            data.latitude!,
            data.longitude!
          );
          if (dist !== null) {
            newLiveDist = dist;
          }
        }
      }

      // Evaluate active altitude for ascent/descent tracking
      const altAssessment = OfflineAltitude.evaluateAltitude(
        data.altitude,
        data.pressure,
        state.config.referencePressureHpa || 1013.25,
        state.config.altitudeSource || 'ONBOARD'
      );
      const currentAlt = altAssessment.estimatedAltitudeMeters;

      let newMaxAlt = state.maxAltitudeMeters;
      let newLaunchAlt = state.launchAltitudeMeters;
      let newRecentAlts = [...state.recentAltitudes];

      if (currentAlt !== null && !isNaN(currentAlt) && isFinite(currentAlt)) {
        // Track flight peak (Apogee)
        if (newMaxAlt === null || currentAlt > newMaxAlt) {
          newMaxAlt = currentAlt;
        }

        // Initialize launch altitude reference if not set yet or still in PRE-LAUNCH
        if (
          newLaunchAlt === null ||
          (data.flightState === 'PRE-LAUNCH' && state.telemetryHistory.length < 5)
        ) {
          newLaunchAlt = currentAlt;
        }

        // Maintain sliding window for vertical motion consecutive packet analysis
        const now = Date.now();
        newRecentAlts.push({ altitude: currentAlt, timestampMs: now });
        // Keep samples from the last 5 seconds, max 12 samples
        newRecentAlts = newRecentAlts.filter((s) => now - s.timestampMs <= 5000).slice(-12);
      }

      // Track last valid INA power sensor measurements
      let newLastValidIna = state.lastValidIna;
      if (
        (data.voltage !== null && !isNaN(data.voltage)) ||
        (data.current !== null && !isNaN(data.current)) ||
        (data.power !== null && !isNaN(data.power))
      ) {
        newLastValidIna = {
          voltage: data.voltage,
          current: data.current,
          power: data.power,
          shuntVoltage: data.shuntVoltage,
          timestampMs: Date.now(),
        };
      }

      return {
        latestTelemetry: data,
        telemetryHistory: history,
        lastValidGps: newLastValidGps,
        liveDistanceMeters: newLiveDist,
        lastValidIna: newLastValidIna,
        maxAltitudeMeters: newMaxAlt,
        launchAltitudeMeters: newLaunchAlt,
        recentAltitudes: newRecentAlts,
      };
    });
  },

  addRawLine: (line) => {
    set((state) => {
      if (state.isRawLogPaused) return {};
      const lines = [...state.rawLogLines, line];
      if (lines.length > 500) {
        lines.shift();
      }
      return { rawLogLines: lines };
    });
  },

  addSystemLog: (msg) => {
    set((state) => {
      const logs = [...state.systemLogs, `[${new Date().toLocaleTimeString()}] ${msg}`];
      if (logs.length > 200) logs.shift();
      return { systemLogs: logs };
    });
  },

  addCommandLog: (log) => {
    set((state) => ({
      commandLogs: [log, ...state.commandLogs],
    }));
  },

  updateCommandLog: (updatedLog) => {
    set((state) => ({
      commandLogs: state.commandLogs.map((item) =>
        item.id === updatedLog.id ? updatedLog : item
      ),
    }));
  },

  toggleGraphPause: () => set((state) => ({ isGraphPaused: !state.isGraphPaused })),
  toggleRawLogPause: () => set((state) => ({ isRawLogPaused: !state.isRawLogPaused })),

  clearHistory: () =>
    set({
      telemetryHistory: [],
      maxAltitudeMeters: null,
      recentAltitudes: [],
    }),
  clearRawLog: () => set({ rawLogLines: [] }),

  setLaunchAltitude: (alt) => set({ launchAltitudeMeters: alt }),

  calibrateLaunchReference: () => {
    const { latestTelemetry, config } = get();
    if (!latestTelemetry) return;
    const altEval = OfflineAltitude.evaluateAltitude(
      latestTelemetry.altitude,
      latestTelemetry.pressure,
      config.referencePressureHpa || 1013.25,
      config.altitudeSource || 'ONBOARD'
    );
    if (altEval.estimatedAltitudeMeters !== null) {
      set({ launchAltitudeMeters: altEval.estimatedAltitudeMeters });
    }
  },

  resetFlightMetrics: () => {
    set({
      maxAltitudeMeters: null,
      launchAltitudeMeters: null,
      recentAltitudes: [],
    });
  },
}));
