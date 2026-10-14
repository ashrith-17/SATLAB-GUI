import { contextBridge, ipcRenderer } from 'electron';
import { CommandItem, ConnectResult, GroundStationConfig, SerialPortInfo } from './types/telemetry';

export interface IElectronAPI {
  // Serial & Connection
  listSerialPorts: () => Promise<SerialPortInfo[]>;
  connectSerialPort: (path: string, baudRate: number) => Promise<ConnectResult>;
  disconnectSerialPort: () => Promise<void>;

  // Commands
  sendCommand: (cmd: CommandItem) => Promise<any>;
  getPredefinedCommands: () => Promise<CommandItem[]>;

  // Config
  getConfig: () => Promise<GroundStationConfig>;
  saveConfig: (cfg: Partial<GroundStationConfig>) => Promise<GroundStationConfig>;

  // Data Listeners
  onTelemetryData: (callback: (data: any) => void) => () => void;
  onRawLine: (callback: (line: string) => void) => () => void;
  onConnectionStatus: (callback: (status: any) => void) => () => void;
  onCommandStatus: (callback: (log: any) => void) => () => void;
  onSystemLog: (callback: (msg: string) => void) => () => void;

  // Actions
  startNewFlightLog: () => Promise<string>;
  openLogFolder: () => Promise<void>;
}

const api: IElectronAPI = {
  listSerialPorts: () => ipcRenderer.invoke('serial:list-ports'),
  connectSerialPort: (path, baudRate) => ipcRenderer.invoke('serial:connect', { path, baudRate }),
  disconnectSerialPort: () => ipcRenderer.invoke('serial:disconnect'),

  sendCommand: (cmd) => ipcRenderer.invoke('command:send', cmd),
  getPredefinedCommands: () => ipcRenderer.invoke('command:get-predefined'),

  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),

  onTelemetryData: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('telemetry:data', handler);
    return () => ipcRenderer.removeListener('telemetry:data', handler);
  },

  onRawLine: (callback) => {
    const handler = (_event: any, line: string) => callback(line);
    ipcRenderer.on('telemetry:raw', handler);
    return () => ipcRenderer.removeListener('telemetry:raw', handler);
  },

  onConnectionStatus: (callback) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on('serial:status-change', handler);
    return () => ipcRenderer.removeListener('serial:status-change', handler);
  },

  onCommandStatus: (callback) => {
    const handler = (_event: any, log: any) => callback(log);
    ipcRenderer.on('command:status-update', handler);
    return () => ipcRenderer.removeListener('command:status-update', handler);
  },

  onSystemLog: (callback) => {
    const handler = (_event: any, msg: string) => callback(msg);
    ipcRenderer.on('system:log', handler);
    return () => ipcRenderer.removeListener('system:log', handler);
  },

  startNewFlightLog: () => ipcRenderer.invoke('logging:new-flight'),
  openLogFolder: () => ipcRenderer.invoke('logging:open-folder'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
