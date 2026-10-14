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

export interface LastValidGps {
  latitude: number;
  longitude: number;
  altitude: number | null;
  sats: number | null;
  speed: number | null;
  timestampMs: number;
}

export interface RangeTestSession {
  isActive: boolean;
  isPaused: boolean;
  currentDistanceMeters: number | null;
  maxDistanceMeters: number | null;
  sessionStartTime: number | null;
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

  // GPS & Range Test
  lastValidGps: LastValidGps | null;
  rangeTest: RangeTestSession;

  // Graph & UI Toggles
  isGraphPaused: boolean;
  isRawLogPaused: boolean;

  // Actions
  setConnectionState: (state: ConnectionState) => void;
  setAvailablePorts: (ports: SerialPortInfo[]) => void;
  setConfig: (config: GroundStationConfig) => void;
  setReferencePressure: (p0: number) => void;
  setAltitudeSource: (source: 'ONBOARD' | 'DPS310_CALCULATED') => void;
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

  // Range Test Actions
  startRangeTest: () => void;
  pauseRangeTest: () => void;
  resumeRangeTest: () => void;
  resetRangeTest: () => void;
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
    customCommands: [],
  },

  latestTelemetry: null,
  telemetryHistory: [],
  rawLogLines: [],
  systemLogs: [],
  commandLogs: [],
  predefinedCommands: [],

  lastValidGps: null,
  rangeTest: {
    isActive: false,
    isPaused: false,
    currentDistanceMeters: null,
    maxDistanceMeters: null,
    sessionStartTime: null,
  },

  isGraphPaused: false,
  isRawLogPaused: false,

  setConnectionState: (state) => set({ connectionState: state }),
  setAvailablePorts: (ports) => set({ availablePorts: ports }),
  setConfig: (config) => {
    set((state) => {
      // Re-evaluate distance if GS coordinates changed and we have valid GPS
      let currentDist = state.rangeTest.currentDistanceMeters;
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
        rangeTest: {
          ...state.rangeTest,
          currentDistanceMeters: currentDist,
        },
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
      let newRangeTest = { ...state.rangeTest };

      if (OfflineGps.isValidCoordinate(data.latitude, data.longitude)) {
        newLastValidGps = {
          latitude: data.latitude!,
          longitude: data.longitude!,
          altitude: data.gpsAltitude,
          sats: data.gpsSats,
          speed: data.gpsSpeed,
          timestampMs: Date.now(),
        };

        // Calculate distance if GS coordinates are valid
        if (OfflineGps.isValidCoordinate(state.config.gsLatitude, state.config.gsLongitude)) {
          const dist = OfflineGps.calculateDistance(
            state.config.gsLatitude,
            state.config.gsLongitude,
            data.latitude!,
            data.longitude!
          );

          if (dist !== null) {
            newRangeTest.currentDistanceMeters = dist;
            // Update peak distance during active non-paused test
            if (newRangeTest.isActive && !newRangeTest.isPaused) {
              const prevMax = newRangeTest.maxDistanceMeters ?? dist;
              newRangeTest.maxDistanceMeters = Math.max(prevMax, dist);
            }
          }
        }
      }

      return {
        latestTelemetry: data,
        telemetryHistory: history,
        lastValidGps: newLastValidGps,
        rangeTest: newRangeTest,
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

  clearHistory: () => set({ telemetryHistory: [] }),
  clearRawLog: () => set({ rawLogLines: [] }),

  startRangeTest: () => {
    set((state) => {
      let currentDist = state.rangeTest.currentDistanceMeters;
      if (
        currentDist === null &&
        state.lastValidGps &&
        OfflineGps.isValidCoordinate(state.config.gsLatitude, state.config.gsLongitude)
      ) {
        currentDist = OfflineGps.calculateDistance(
          state.config.gsLatitude,
          state.config.gsLongitude,
          state.lastValidGps.latitude,
          state.lastValidGps.longitude
        );
      }
      return {
        rangeTest: {
          isActive: true,
          isPaused: false,
          currentDistanceMeters: currentDist,
          maxDistanceMeters: currentDist,
          sessionStartTime: Date.now(),
        },
      };
    });
  },

  pauseRangeTest: () => {
    set((state) => ({
      rangeTest: {
        ...state.rangeTest,
        isPaused: true,
      },
    }));
  },

  resumeRangeTest: () => {
    set((state) => ({
      rangeTest: {
        ...state.rangeTest,
        isPaused: false,
      },
    }));
  },

  resetRangeTest: () => {
    set((state) => {
      let currentDist: number | null = null;
      if (
        state.lastValidGps &&
        OfflineGps.isValidCoordinate(state.config.gsLatitude, state.config.gsLongitude)
      ) {
        currentDist = OfflineGps.calculateDistance(
          state.config.gsLatitude,
          state.config.gsLongitude,
          state.lastValidGps.latitude,
          state.lastValidGps.longitude
        );
      }
      return {
        rangeTest: {
          isActive: false,
          isPaused: false,
          currentDistanceMeters: currentDist,
          maxDistanceMeters: null,
          sessionStartTime: null,
        },
      };
    });
  },
}));
