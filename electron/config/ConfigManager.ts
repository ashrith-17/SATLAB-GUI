import fs from 'fs';
import path from 'path';
import { GroundStationConfig } from '../types/telemetry';

export class ConfigManager {
  private configPath: string;
  private currentConfig: GroundStationConfig;

  private defaultConfig: GroundStationConfig = {
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
  };

  constructor(appPath: string) {
    const configDir = path.join(appPath, 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.configPath = path.join(configDir, 'ground_station.json');
    this.currentConfig = this.loadConfig();
  }

  public getConfig(): GroundStationConfig {
    return { ...this.currentConfig };
  }

  public saveConfig(newConfig: Partial<GroundStationConfig>): GroundStationConfig {
    this.currentConfig = {
      ...this.currentConfig,
      ...newConfig,
    };

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.currentConfig, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save config file:', err);
    }

    return this.getConfig();
  }

  private loadConfig(): GroundStationConfig {
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(content);
      return { ...this.defaultConfig, ...parsed };
    } catch (err) {
      console.error('Error reading config file, using defaults:', err);
      return this.defaultConfig;
    }
  }
}
