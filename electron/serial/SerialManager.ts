import { EventEmitter } from 'events';
import { ConnectResult, SerialPortInfo } from '../types/telemetry';

export class SerialManager extends EventEmitter {
  private portInstance: any = null;
  private SerialPortClass: any = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private currentPortPath: string = '';
  private currentBaudRate: number = 115200;

  private totalBytesReceived: number = 0;

  constructor() {
    super();
    this.loadSerialPortModule();
  }

  private loadSerialPortModule(): void {
    try {
      const sp = require('serialport');
      this.SerialPortClass = sp.SerialPort;
    } catch (err) {
      console.error('[SerialManager] Physical SerialPort native module failed to load:', err);
    }
  }

  /**
   * Enumerate actual physical serial ports from the system using the SerialPort library.
   * Strictly filters out any virtual Bluetooth COM ports so only physical receiver options appear.
   * Never returns mock or virtual placeholder data.
   */
  public async listPorts(): Promise<SerialPortInfo[]> {
    if (!this.SerialPortClass) {
      console.warn('[SerialManager] SerialPort library is unavailable to enumerate ports.');
      return [];
    }

    try {
      const ports = await this.SerialPortClass.list();
      const physicalPorts: SerialPortInfo[] = [];

      for (const p of ports) {
        const pnpId = (p.pnpId || '').toUpperCase();
        const friendlyName = (p.friendlyName || '').toLowerCase();
        const manufacturer = (p.manufacturer || '').toLowerCase();
        const path = (p.path || '').toLowerCase();

        // Strictly reject any Bluetooth virtual COM ports created by Windows
        const isBluetooth =
          pnpId.includes('BTHENUM') ||
          pnpId.includes('BTH') ||
          friendlyName.includes('bluetooth') ||
          friendlyName.includes('bth') ||
          manufacturer.includes('bluetooth') ||
          path.includes('bth');

        if (isBluetooth) {
          continue;
        }

        physicalPorts.push({
          path: p.path,
          manufacturer: p.manufacturer || '',
          serialNumber: p.serialNumber,
          vendorId: p.vendorId,
          productId: p.productId,
          friendlyName: p.friendlyName || p.path,
          pnpId: p.pnpId,
        });
      }

      return physicalPorts;
    } catch (err) {
      console.error('[SerialManager] Error listing serial ports:', err);
      return [];
    }
  }

  public getTotalBytesReceived(): number {
    return this.totalBytesReceived;
  }

  public resetBytesReceived(): void {
    this.totalBytesReceived = 0;
  }

  /**
   * Human-readable and actionable error translation for serial port exceptions.
   * Explicitly detects when another application owns the port (Access Denied / Win32 Error 5).
   */
  private formatSerialError(err: any, path: string): { message: string; underlyingError: string; instruction: string } {
    const rawMsg = err?.message || String(err || 'Unknown error');

    // Access Denied / Port in use by another application (Win32 Error 5, EBUSY, EACCES)
    if (
      rawMsg.includes('Access is denied') ||
      rawMsg.includes('code 5') ||
      rawMsg.includes('EACCES') ||
      rawMsg.includes('EBUSY') ||
      rawMsg.toLowerCase().includes('permission denied') ||
      rawMsg.toLowerCase().includes('cannot lock port') ||
      rawMsg.toLowerCase().includes('busy')
    ) {
      return {
        message: `Access denied to port ${path} (Win32 Error 5: Access is denied).`,
        underlyingError: rawMsg,
        instruction: `Port ${path} is currently owned or held by another application. Please close Arduino IDE (Serial Monitor/Plotter), PuTTY, VS Code Serial Monitor, or any other program holding ${path}, then retry.`,
      };
    }

    // Timeout (Win32 Error 121: ERROR_SEM_TIMEOUT)
    if (rawMsg.includes('121') || rawMsg.toLowerCase().includes('semaphore') || rawMsg.toLowerCase().includes('timeout')) {
      return {
        message: `Timeout opening port ${path} (Win32 Error 121: Semaphore Timeout).`,
        underlyingError: rawMsg,
        instruction: `The hardware port did not respond within the timeout period. Verify that your receiver is connected to the physical USB port, powered on, and not an inactive virtual Bluetooth port.`,
      };
    }

    // Port Not Found (Win32 Error 2: ERROR_FILE_NOT_FOUND)
    if (rawMsg.includes('code 2') || rawMsg.toLowerCase().includes('file not found') || rawMsg.toLowerCase().includes('cannot find the file')) {
      return {
        message: `Port ${path} was not found (Win32 Error 2: The system cannot find the file specified).`,
        underlyingError: rawMsg,
        instruction: `The hardware receiver appears to have been unplugged or reset. Reconnect the USB cable firmly and click Refresh Ports.`,
      };
    }

    // Hardware Failure (Win32 Error 31)
    if (rawMsg.includes('code 31')) {
      return {
        message: `Device attached to port ${path} is not functioning (Win32 Error 31).`,
        underlyingError: rawMsg,
        instruction: `Check USB cable connection or ensure the required USB-to-UART driver (e.g. CP210x, CH340, FTDI) is installed.`,
      };
    }

    // General fallback
    return {
      message: `Failed to open port ${path}: ${rawMsg}`,
      underlyingError: rawMsg,
      instruction: `Verify that the receiver is securely connected, the selected baud rate matches the receiver firmware, and no other software is using the port.`,
    };
  }

  private safeEmitError(message: string): void {
    if (this.listenerCount('error') > 0) {
      this.emit('error', message);
    } else {
      console.warn('[SerialManager] Notice:', message);
    }
  }

  /**
   * Connect to the exact specified COM port and baud rate.
   * Prevents duplicate connection attempts while a port is opening or already open.
   */
  public async connect(path: string, baudRate: number = 115200): Promise<ConnectResult> {
    if (this.isConnecting) {
      return {
        success: false,
        error: `Connection attempt already in progress for port ${this.currentPortPath || path}.`,
        underlyingError: 'DUPLICATE_CONNECT_ATTEMPT',
        instruction: 'Please wait for the current connection attempt to complete.',
        suggestedAction: 'Please wait for the current connection attempt to complete.',
      };
    }

    if (this.isConnected) {
      return {
        success: false,
        error: `Port ${this.currentPortPath} is already open.`,
        underlyingError: 'ALREADY_CONNECTED',
        instruction: 'Please disconnect before opening another port.',
        suggestedAction: 'Please disconnect before opening another port.',
      };
    }

    if (!this.SerialPortClass) {
      const errorMsg = 'Physical SerialPort library is not compiled or available.';
      this.safeEmitError(errorMsg);
      return {
        success: false,
        error: errorMsg,
        underlyingError: 'MODULE_NOT_FOUND',
        instruction: 'Ensure node-serialport bindings are installed.',
        suggestedAction: 'Ensure node-serialport bindings are installed.',
      };
    }

    this.isConnecting = true;
    this.currentPortPath = path;
    this.currentBaudRate = baudRate;
    this.totalBytesReceived = 0;

    // Clean up any stale port reference before attempting new connection
    if (this.portInstance) {
      try {
        this.portInstance.removeAllListeners();
        if (this.portInstance.isOpen) {
          this.portInstance.close();
        }
      } catch (e) {
        // Ignore
      }
      this.portInstance = null;
    }

    return new Promise<ConnectResult>((resolve) => {
      try {
        console.log(`[SerialManager] Attempting to open physical port ${path} at ${baudRate} baud...`);
        this.portInstance = new this.SerialPortClass({
          path,
          baudRate: Number(baudRate),
          autoOpen: false,
        });

        // Set up error listener for runtime errors
        this.portInstance.on('error', (err: any) => {
          console.error(`[SerialManager] Serial port runtime error on ${path}:`, err);
          const formatted = this.formatSerialError(err, path);
          this.safeEmitError(formatted.message);

          // If the device was unplugged or stopped functioning during runtime, trigger clean disconnect
          const errStr = (err?.message || '').toLowerCase();
          if (
            errStr.includes('file not found') ||
            errStr.includes('cannot find the file') ||
            errStr.includes('disconnected') ||
            errStr.includes('bad file descriptor') ||
            errStr.includes('device is not functioning') ||
            errStr.includes('code 2') ||
            errStr.includes('code 31')
          ) {
            this.disconnect();
          }
        });

        this.portInstance.open(async (err: any) => {
          this.isConnecting = false;

          if (err) {
            console.error(`[SerialManager] Failed to open port ${path}:`, err);
            const formatted = this.formatSerialError(err, path);
            this.safeEmitError(formatted.message);
            this.isConnected = false;
            this.portInstance = null;
            return resolve({
              success: false,
              error: formatted.message,
              underlyingError: formatted.underlyingError,
              instruction: formatted.instruction,
              suggestedAction: formatted.instruction,
            });
          }

          console.log(`[SerialManager] Successfully opened physical serial port ${path} at ${baudRate} baud.`);
          this.isConnected = true;

          // Set DTR and RTS lines - essential for ESP32, Arduino, CP2102, FTDI modules
          try {
            this.portInstance.set({ dtr: true, rts: true }, (setErr: any) => {
              if (setErr) {
                console.warn('[SerialManager] Could not set DTR/RTS (normal for some virtual ports):', setErr.message);
              }
            });
          } catch (e) {
            // Ignore if unsupported by driver
          }

          // Handle incoming serial data as a stream:
          // Buffer chunks and split cleanly on CRLF or LF delimiters.
          let rxBuffer = '';
          this.portInstance.on('data', (chunk: Buffer | string) => {
            const str = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
            const byteLen = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, 'utf-8');
            this.totalBytesReceived += byteLen;
            this.emit('bytes-received', byteLen);

            rxBuffer += str;

            let lineEnd: number;
            while ((lineEnd = rxBuffer.search(/\r\n|\n|\r/)) !== -1) {
              // If the chunk ends exactly with '\r', wait for potential '\n' in the next chunk
              if (rxBuffer[lineEnd] === '\r' && lineEnd === rxBuffer.length - 1) {
                break;
              }
              const delimiterLen = rxBuffer[lineEnd] === '\r' && rxBuffer[lineEnd + 1] === '\n' ? 2 : 1;
              const line = rxBuffer.slice(0, lineEnd).trim();
              rxBuffer = rxBuffer.slice(lineEnd + delimiterLen);

              if (line.length > 0) {
                this.emit('data', line);
              }
            }

            if (rxBuffer.length > 4096) {
              console.warn(`[SerialManager] RX buffer on ${path} exceeded 4096 bytes without newline delimiter.`);
              const trimmed = rxBuffer.trim();
              if (trimmed.length > 0) {
                this.emit('data', trimmed);
              }
              rxBuffer = '';
            }
          });

          this.portInstance.on('close', () => {
            console.log(`[SerialManager] Physical port ${path} closed.`);
            this.isConnected = false;
            this.isConnecting = false;
            this.portInstance = null;
            this.emit('close');
            this.emit('disconnect');
          });

          this.emit('connect', { path, baudRate });
          resolve({ success: true });
        });
      } catch (err: any) {
        this.isConnecting = false;
        console.error(`[SerialManager] Exception while initializing port ${path}:`, err);
        const formatted = this.formatSerialError(err, path);
        this.safeEmitError(formatted.message);
        this.isConnected = false;
        this.portInstance = null;
        resolve({
          success: false,
          error: formatted.message,
          underlyingError: formatted.underlyingError,
          instruction: formatted.instruction,
          suggestedAction: formatted.instruction,
        });
      }
    });
  }

  /**
   * Closes the port cleanly and releases all operating system resources.
   */
  public async disconnect(): Promise<void> {
    if (this.portInstance) {
      const port = this.portInstance;
      this.portInstance = null;
      this.isConnected = false;
      this.isConnecting = false;

      try {
        port.removeAllListeners();
      } catch (e) {
        // Ignore
      }

      if (port.isOpen) {
        await new Promise<void>((resolve) => {
          port.close((err: any) => {
            if (err) console.error('[SerialManager] Error during port close:', err);
            resolve();
          });
        });
      }
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.currentPortPath = '';
    this.emit('disconnect');
  }

  public write(commandPayload: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isConnected || !this.portInstance) {
        this.safeEmitError('Cannot send command: Serial port is not connected.');
        return resolve(false);
      }

      const formattedPayload = commandPayload.endsWith('\n')
        ? commandPayload
        : commandPayload + '\r\n';

      this.portInstance.write(formattedPayload, (err: any) => {
        if (err) {
          console.error('[SerialManager] Error writing to serial port:', err);
          this.safeEmitError(`Send failed: ${err.message}`);
          return resolve(false);
        }
        resolve(true);
      });
    });
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsConnecting(): boolean {
    return this.isConnecting;
  }

  public getCurrentPortPath(): string {
    return this.currentPortPath;
  }

  public getCurrentBaudRate(): number {
    return this.currentBaudRate;
  }
}
