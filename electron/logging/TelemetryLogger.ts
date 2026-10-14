import fs from 'fs';
import path from 'path';
import { TelemetryData } from '../types/telemetry';

export class TelemetryLogger {
  private baseDir: string;
  private telemetryStream: fs.WriteStream | null = null;
  private commandStream: fs.WriteStream | null = null;
  private systemStream: fs.WriteStream | null = null;
  private currentFlightFile: string = '';

  constructor(appPath: string) {
    this.baseDir = path.join(appPath, 'logs');
    this.initDirectories();
    this.startNewFlightLog();
  }

  private initDirectories(): void {
    const dirs = [
      path.join(this.baseDir, 'telemetry'),
      path.join(this.baseDir, 'commands'),
      path.join(this.baseDir, 'system'),
    ];

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    const sysLogPath = path.join(this.baseDir, 'system', 'ground_station.log');
    this.systemStream = fs.createWriteStream(sysLogPath, { flags: 'a' });
    this.logSystem('Ground Station Logger Initialized');
  }

  public startNewFlightLog(): void {
    if (this.telemetryStream) {
      this.telemetryStream.end();
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `flight_${timestamp}.csv`;
    const filePath = path.join(this.baseDir, 'telemetry', filename);
    this.currentFlightFile = filePath;

    this.telemetryStream = fs.createWriteStream(filePath, { flags: 'a' });

    // CSV Header
    const header = [
      'PacketNo',
      'Timestamp',
      'Altitude(m)',
      'Temp(C)',
      'Humidity(%RH)',
      'Pressure(hPa)',
      'Battery(%)',
      'Roll(deg)',
      'Pitch(deg)',
      'Yaw(deg)',
      'GX',
      'GY',
      'GZ',
      'AX',
      'AY',
      'AZ',
      'Latitude',
      'Longitude',
      'GPS_Alt',
      'GPS_Sats',
      'GPS_Speed(m/s)',
      'RSSI',
      'FlightState',
      'RawPacket',
    ].join(',') + '\n';

    this.telemetryStream.write(header);
    this.logSystem(`Started new flight telemetry log file: ${filename}`);
  }

  public logTelemetry(data: TelemetryData): void {
    if (!this.telemetryStream) return;

    const row = [
      data.packetNumber,
      `"${data.timestamp}"`,
      data.altitude.toFixed(2),
      data.temperature.toFixed(2),
      data.humidity !== null && data.humidity !== undefined ? data.humidity.toFixed(1) : '',
      data.pressure.toFixed(2),
      data.battery.toFixed(1),
      data.roll.toFixed(2),
      data.pitch.toFixed(2),
      data.yaw.toFixed(2),
      data.gx.toFixed(4),
      data.gy.toFixed(4),
      data.gz.toFixed(4),
      data.ax.toFixed(4),
      data.ay.toFixed(4),
      data.az.toFixed(4),
      data.latitude !== null ? data.latitude.toFixed(6) : '',
      data.longitude !== null ? data.longitude.toFixed(6) : '',
      data.gpsAltitude !== null ? data.gpsAltitude.toFixed(1) : '',
      data.gpsSats !== null ? data.gpsSats : '',
      data.gpsSpeed !== null && data.gpsSpeed !== undefined ? data.gpsSpeed.toFixed(1) : '',
      data.rssi !== null ? data.rssi : '',
      `"${data.flightState}"`,
      `"${data.rawPacket.replace(/"/g, '""')}"`,
    ].join(',') + '\n';

    this.telemetryStream.write(row);
  }

  public logCommand(
    commandName: string,
    payload: string,
    status: string,
    response?: string
  ): void {
    const cmdLogPath = path.join(this.baseDir, 'commands', 'command_log.csv');
    const fileExists = fs.existsSync(cmdLogPath);

    if (!this.commandStream) {
      this.commandStream = fs.createWriteStream(cmdLogPath, { flags: 'a' });
      if (!fileExists) {
        this.commandStream.write('Timestamp,Command,Payload,Status,Response\n');
      }
    }

    const row = [
      `"${new Date().toISOString()}"`,
      `"${commandName}"`,
      `"${payload}"`,
      `"${status}"`,
      `"${response || ''}"`,
    ].join(',') + '\n';

    this.commandStream.write(row);
    this.logSystem(`Command logged: ${commandName} -> ${status}`);
  }

  public logSystem(message: string): void {
    if (!this.systemStream) return;
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    this.systemStream.write(entry);
    console.log(`[SYS_LOG] ${message}`);
  }

  public getCurrentFlightFilePath(): string {
    return this.currentFlightFile;
  }
}
