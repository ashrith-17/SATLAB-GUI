import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { SerialManager } from './serial/SerialManager';
import { TelemetryParser } from './serial/TelemetryParser';
import { TelemetryLogger } from './logging/TelemetryLogger';
import { CommandManager } from './commands/CommandManager';
import { ConfigManager } from './config/ConfigManager';
import { ConnectionState, ConnectionStatus, SignalStatus, TelemetryData } from './types/telemetry';

class Application {
  private mainWindow: BrowserWindow | null = null;
  private serialManager: SerialManager;
  private parser: TelemetryParser;
  private logger: TelemetryLogger;
  private commandManager: CommandManager;
  private configManager: ConfigManager;

  // Signal & Packet Rate Tracking
  private lastPacketTime: number = 0;
  private lastPacketTimestamp: string | null = null;
  private packetCountInWindow: number = 0;
  private totalReceivedCount: number = 0;
  private parseErrorCount: number = 0;
  private lostPacketCount: number = 0;
  private lastSeenPacketNumber: number = -1;
  private currentPacketRateHz: number = 0;
  private lastSerialError: string | null = null;
  private lastSerialInstruction: string | null = null;
  private signalCheckInterval: NodeJS.Timeout | null = null;
  private rateCalcInterval: NodeJS.Timeout | null = null;

  constructor() {
    const rootPath = app.getPath('userData');
    this.logger = new TelemetryLogger(rootPath);
    this.configManager = new ConfigManager(rootPath);
    this.serialManager = new SerialManager();
    this.parser = new TelemetryParser();
    this.commandManager = new CommandManager(this.logger);

    this.setupListeners();
    this.setupIpcHandlers();
  }

  public async init(): Promise<void> {
    await app.whenReady();
    this.createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    this.startRateAndSignalMonitors();
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 720,
      title: 'TEAM INDRA — CanSat Ground Station Mission Control',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

    if (isDev && process.env.VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      const prodPath = path.join(__dirname, '../dist/index.html');
      this.mainWindow.loadFile(prodPath);
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupListeners(): void {
    // Handle physical serial raw lines
    this.serialManager.on('data', (rawLine: string) => {
      this.processRawLine(rawLine);
    });

    this.serialManager.on('bytes-received', () => {
      // Periodic monitor sends state updates, but can notify on activity
    });

    this.serialManager.on('error', (errMsg: string) => {
      this.lastSerialError = errMsg;
      this.sendSystemLog(`Serial Error: ${errMsg}`);
      this.sendConnectionStatusUpdate();
    });

    this.serialManager.on('connect', (info: any) => {
      this.lastSerialError = null;
      this.lastSerialInstruction = null;
      this.sendSystemLog(`Connected to physical serial port ${info.path} at ${info.baudRate} baud`);
      this.sendConnectionStatusUpdate();
    });

    this.serialManager.on('disconnect', () => {
      this.sendSystemLog('Disconnected from physical serial port');
      this.sendConnectionStatusUpdate();
    });

    // Handle Command ACK / Timeouts
    this.commandManager.on('command-ack', (log: any) => {
      this.sendToRenderer('command:status-update', log);
    });

    this.commandManager.on('command-timeout', (log: any) => {
      this.sendToRenderer('command:status-update', log);
    });
  }

  private processRawLine(rawLine: string): void {
    // Send raw packet line to terminal UI
    this.sendToRenderer('telemetry:raw', rawLine);

    // Pass line to Command ACK inspector
    this.commandManager.handleIncomingPacket(rawLine);

    // Parse packet
    const parsedData: TelemetryData | null = this.parser.parseLine(rawLine);
    if (!parsedData) {
      if (!rawLine.startsWith('ACK:') && !rawLine.startsWith('CMD:')) {
        this.parseErrorCount++;
      }
      return;
    }

    this.lastPacketTime = Date.now();
    this.lastPacketTimestamp = parsedData.timestamp;
    this.totalReceivedCount++;
    this.packetCountInWindow++;

    // Track lost packets by checking sequence numbers
    if (this.lastSeenPacketNumber > 0 && parsedData.packetNumber > this.lastSeenPacketNumber + 1) {
      const missed = parsedData.packetNumber - this.lastSeenPacketNumber - 1;
      this.lostPacketCount += missed;
    }
    this.lastSeenPacketNumber = parsedData.packetNumber;

    // Log telemetry locally
    this.logger.logTelemetry(parsedData);

    // Send parsed frame to Renderer UI
    this.sendToRenderer('telemetry:data', parsedData);
  }

  private startRateAndSignalMonitors(): void {
    // Every 1 sec calculate Hz rate
    this.rateCalcInterval = setInterval(() => {
      this.currentPacketRateHz = this.packetCountInWindow;
      this.packetCountInWindow = 0;
      this.sendConnectionStatusUpdate();
    }, 1000);

    // Every 500 ms check for signal timeout
    this.signalCheckInterval = setInterval(() => {
      this.sendConnectionStatusUpdate();
    }, 500);
  }

  private sendConnectionStatusUpdate(): void {
    const isConn = this.serialManager.getIsConnected();
    const isOpening = this.serialManager.getIsConnecting();

    let status: ConnectionStatus = 'DISCONNECTED';
    if (isOpening) {
      status = 'OPENING';
    } else if (isConn) {
      status = 'CONNECTED';
    } else if (this.lastSerialError) {
      status = 'ERROR';
    }

    const config = this.configManager.getConfig();
    const timeSinceLastSec = this.lastPacketTime > 0 ? (Date.now() - this.lastPacketTime) / 1000 : 999;
    const isReceiving = isConn && this.lastPacketTime > 0 && timeSinceLastSec <= config.packetTimeoutMs / 1000;

    let signalStatus: SignalStatus = 'DISCONNECTED';
    if (isConn) {
      signalStatus = isReceiving ? 'RECEIVING' : 'NO SIGNAL';
    }

    const state: ConnectionState = {
      status,
      isConnected: isConn,
      port: isConn ? this.serialManager.getCurrentPortPath() || 'Disconnected' : 'Disconnected',
      baudRate: this.serialManager.getCurrentBaudRate(),
      packetRate: this.currentPacketRateHz,
      totalPackets: this.totalReceivedCount,
      lostPackets: this.lostPacketCount,
      lastPacketAgeSec: Math.min(99, parseFloat(timeSinceLastSec.toFixed(1))),
      signalStatus,
      totalBytesReceived: this.serialManager.getTotalBytesReceived(),
      lastPacketTimestamp: this.lastPacketTimestamp,
      parseErrorCount: this.parseErrorCount,
      lastError: this.lastSerialError,
      lastErrorInstruction: this.lastSerialInstruction,
    };

    this.sendToRenderer('serial:status-change', state);
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('serial:list-ports', async () => {
      return await this.serialManager.listPorts();
    });

    ipcMain.handle('serial:connect', async (_event, { path, baudRate }) => {
      this.lastSerialError = null;
      this.lastSerialInstruction = null;
      this.sendConnectionStatusUpdate();

      const result = await this.serialManager.connect(path, baudRate);
      if (!result.success) {
        this.lastSerialError = result.error || `Failed to open port ${path}.`;
        this.lastSerialInstruction = result.instruction || result.suggestedAction || null;
      } else {
        this.lastSerialError = null;
        this.lastSerialInstruction = null;
      }
      this.sendConnectionStatusUpdate();
      return result;
    });

    ipcMain.handle('serial:disconnect', async () => {
      await this.serialManager.disconnect();
      this.lastSerialError = null;
      this.lastSerialInstruction = null;
      this.sendConnectionStatusUpdate();
      return true;
    });

    ipcMain.handle('command:send', async (_event, cmdItem) => {
      const log = this.commandManager.registerCommandLog(cmdItem);
      let success = false;

      if (this.serialManager.getIsConnected()) {
        success = await this.serialManager.write(cmdItem.payload);
      }

      if (!success) {
        log.status = 'FAILED';
        this.sendToRenderer('command:status-update', log);
      }

      return log;
    });

    ipcMain.handle('command:get-predefined', async () => {
      return this.commandManager.getPredefinedCommands();
    });

    ipcMain.handle('config:get', async () => {
      return this.configManager.getConfig();
    });

    ipcMain.handle('config:save', async (_event, newCfg) => {
      return this.configManager.saveConfig(newCfg);
    });

    ipcMain.handle('logging:new-flight', async () => {
      this.logger.startNewFlightLog();
      return this.logger.getCurrentFlightFilePath();
    });

    ipcMain.handle('logging:open-folder', async () => {
      const logsPath = path.join(app.getPath('userData'), 'logs');
      shell.openPath(logsPath);
    });
  }

  private sendToRenderer(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private sendSystemLog(msg: string): void {
    this.logger.logSystem(msg);
    this.sendToRenderer('system:log', msg);
  }
}

const mainApp = new Application();
mainApp.init();
