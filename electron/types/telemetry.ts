export type FlightState = 'PRE-LAUNCH' | 'ASCENT' | 'DESCENT' | 'LANDED' | 'UNKNOWN';

export interface TelemetryData {
  packetNumber: number;
  timestamp: string;
  timestampMs: number;
  altitude: number; // Transmitted onboard altitude (m)
  temperature: number; // BME280 Temperature (°C)
  humidity: number | null; // BME280 Relative Humidity (% RH)
  pressure: number; // DPS310 Atmospheric Pressure (hPa)
  battery: number;
  roll: number;
  pitch: number;
  yaw: number;
  gx: number;
  gy: number;
  gz: number;
  ax: number;
  ay: number;
  az: number;
  latitude: number | null;
  longitude: number | null;
  gpsAltitude: number | null;
  gpsSats: number | null;
  gpsSpeed: number | null; // Ground speed in m/s
  rssi: number | null;
  flightState: FlightState;
  rawPacket: string;
}

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  friendlyName?: string;
  pnpId?: string;
}

export interface ConnectResult {
  success: boolean;
  error?: string;
  underlyingError?: string;
  instruction?: string;
  suggestedAction?: string;
}

export type SignalStatus = 'RECEIVING' | 'NO SIGNAL' | 'DISCONNECTED';
export type ConnectionStatus = 'DISCONNECTED' | 'OPENING' | 'CONNECTED' | 'ERROR';

export interface ConnectionState {
  status: ConnectionStatus;
  isConnected: boolean;
  port: string;
  baudRate: number;
  packetRate: number; // Hz
  totalPackets: number;
  lostPackets: number;
  lastPacketAgeSec: number;
  signalStatus: SignalStatus;
  totalBytesReceived: number;
  lastPacketTimestamp: string | null;
  parseErrorCount: number;
  lastError: string | null;
  lastErrorInstruction: string | null;
}

export interface CommandItem {
  id: string;
  name: string;
  payload: string;
  isCritical: boolean;
  description: string;
}

export type CommandStatus = 'SENT' | 'ACKNOWLEDGED' | 'TIMEOUT' | 'FAILED';

export interface CommandLog {
  id: string;
  timestamp: string;
  commandName: string;
  payload: string;
  status: CommandStatus;
  response?: string;
}

export interface GPSCalculation {
  distanceMeters: number | null;
  distanceKm: number | null;
  bearingDeg: number | null;
  hasFix: boolean;
}

export interface GroundStationConfig {
  gsLatitude: number;
  gsLongitude: number;
  gsAltitude: number;
  defaultBaudRate: number;
  packetTimeoutMs: number;
  maxGraphPoints: number;
  parserDelimiter: string;
  referencePressureHpa: number; // Reference sea-level/ground pressure P0 in hPa (default: 1013.25)
  altitudeSource: 'ONBOARD' | 'DPS310_CALCULATED'; // Active altitude source for primary display
  customCommands: CommandItem[];
}
