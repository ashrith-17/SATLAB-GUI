import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info,
  Plug,
  Radio,
  RefreshCw,
  Terminal,
  Unplug,
  X,
  Zap,
} from 'lucide-react';
import { ConnectResult, SerialPortInfo } from '../../types/telemetry';

export const SerialPanel: React.FC = () => {
  const { connectionState, availablePorts, setAvailablePorts } = useTelemetryStore();
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  // Detailed error reporting for operator
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    underlyingError?: string;
    instruction?: string;
  } | null>(null);

  const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

  const fetchPorts = async (silent: boolean = false) => {
    if (!window.electronAPI) return;
    if (!silent) setIsRefreshing(true);

    try {
      const ports: SerialPortInfo[] = await window.electronAPI.listSerialPorts();
      setAvailablePorts(ports);

      // Do NOT lose user's valid selection if the port is still in the refreshed list
      const currentExists = ports.some((p) => p.path === selectedPort);
      if (!selectedPort || !currentExists) {
        if (ports.length > 0) {
          setSelectedPort(ports[0].path);
        } else {
          setSelectedPort('');
        }
      }
    } catch (err) {
      console.error('[SerialPanel] Failed to list physical serial ports:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  // Initial enumeration on mount
  useEffect(() => {
    fetchPorts();
  }, []);

  // Periodic background check so hotplugging receiver refreshes the physical list
  useEffect(() => {
    if (connectionState.isConnected || isConnecting) return;

    const interval = setInterval(() => {
      fetchPorts(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [connectionState.isConnected, isConnecting, selectedPort]);

  // Synchronize internal error state with store errors
  useEffect(() => {
    if (connectionState.lastError) {
      setErrorDetails({
        message: connectionState.lastError,
        instruction: connectionState.lastErrorInstruction || undefined,
      });
    }
  }, [connectionState.lastError, connectionState.lastErrorInstruction]);

  const handleConnect = async () => {
    if (!window.electronAPI) return;

    // Prevent duplicate connection attempts while opening or already connected
    if (isConnecting || connectionState.isConnected || connectionState.status === 'OPENING') {
      console.warn('[SerialPanel] Connection attempt ignored: already connecting or connected.');
      return;
    }

    if (!selectedPort) {
      setErrorDetails({
        message: 'No physical COM port selected.',
        instruction: 'Please plug in your physical ground receiver via USB and select a valid COM port from the dropdown.',
      });
      return;
    }

    setIsConnecting(true);
    setErrorDetails(null);

    try {
      console.log(`[SerialPanel] Initiating connection to ${selectedPort} at ${baudRate} baud...`);
      const result: ConnectResult = await window.electronAPI.connectSerialPort(selectedPort, baudRate);

      if (!result.success) {
        console.error('[SerialPanel] Connection failed:', result);
        setErrorDetails({
          message: result.error || `Failed to open physical COM port ${selectedPort}.`,
          underlyingError: result.underlyingError,
          instruction:
            result.instruction ||
            result.suggestedAction ||
            'Verify the USB connection, ensure drivers are installed, and check that no other software is using this port.',
        });
      } else {
        console.log(`[SerialPanel] Successfully connected to ${selectedPort}`);
        setErrorDetails(null);
      }
    } catch (err: any) {
      console.error('[SerialPanel] Unexpected connection exception:', err);
      setErrorDetails({
        message: err.message || 'An unexpected error occurred while opening the COM port.',
        underlyingError: String(err),
        instruction: 'Ensure the serial port is not held by another process and reconnect the USB cable.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.electronAPI) return;
    setErrorDetails(null);
    try {
      console.log('[SerialPanel] Disconnecting physical serial port...');
      await window.electronAPI.disconnectSerialPort();
    } catch (err) {
      console.error('[SerialPanel] Error during disconnect:', err);
    }
  };

  const selectedPortInfo = availablePorts.find((p) => p.path === selectedPort);

  // Suggested next action string computation
  const getSuggestedAction = (): string => {
    if (errorDetails) {
      const msg = (errorDetails.message + ' ' + (errorDetails.underlyingError || '')).toLowerCase();
      if (msg.includes('access is denied') || msg.includes('code 5') || msg.includes('ebusy') || msg.includes('busy')) {
        return 'Port is held by another process. Close Arduino Serial Monitor, PuTTY, or VS Code, then retry.';
      }
      if (msg.includes('file not found') || msg.includes('code 2') || msg.includes('cannot find')) {
        return 'Receiver was unplugged or reset. Reconnect USB cable and click Refresh Ports.';
      }
      if (msg.includes('timeout') || msg.includes('121')) {
        return 'Hardware semaphore timeout. Verify receiver is powered on and baud rate matches firmware.';
      }
      if (msg.includes('code 31')) {
        return 'Device error in Windows. Reinstall official USB-UART driver (CP210x / CH340 / FTDI).';
      }
      return errorDetails.instruction || 'Inspect Windows Device Manager and check physical USB connection.';
    }

    if (availablePorts.length === 0) {
      return 'Check USB cable connection and verify driver in Windows Device Manager (see checklist below).';
    }

    if (!connectionState.isConnected) {
      return 'Select the physical receiver COM port and click CONNECT.';
    }

    if (connectionState.signalStatus === 'RECEIVING') {
      return 'Physical telemetry link nominal. Real packets arriving and logging.';
    }

    return 'COM port open. Awaiting incoming telemetry packets from receiver.';
  };

  return (
    <div className="bg-white border-b border-slate-200">
      {/* 1. Action / Error Banner */}
      {errorDetails && (
        <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-start justify-between gap-4 text-xs text-rose-900">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-800 flex flex-wrap items-center gap-2">
                <span>COM Port Error:</span>
                <span className="font-mono font-normal">{errorDetails.message}</span>
              </div>

              {errorDetails.underlyingError && errorDetails.underlyingError !== errorDetails.message && (
                <div className="font-mono text-[11px] text-rose-700 bg-rose-100/60 px-2 py-1 rounded border border-rose-200 break-all">
                  <strong>Details: </strong> {errorDetails.underlyingError}
                </div>
              )}

              {errorDetails.instruction && (
                <div className="text-slate-800 text-[11px] bg-white border border-rose-200 p-2 rounded leading-relaxed">
                  <strong>Suggested Action: </strong>
                  {errorDetails.instruction}
                </div>
              )}

              <div className="pt-1 flex items-center gap-3">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="font-semibold text-rose-700 hover:text-rose-900 underline cursor-pointer disabled:opacity-50"
                >
                  Retry Connection
                </button>
                <button
                  onClick={() => setShowDiagnostics(true)}
                  className="font-semibold text-sky-700 hover:text-sky-900 underline cursor-pointer"
                >
                  Open Diagnostics
                </button>
                <button
                  onClick={() => setErrorDetails(null)}
                  className="font-semibold text-slate-600 hover:text-slate-800 underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => setErrorDetails(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Zero COM Ports Detected Requirement Banner */}
      {availablePorts.length === 0 && !connectionState.isConnected && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between gap-4 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold text-amber-950">
              No physical serial COM port detected. Check the receiver's USB connection, data cable, Windows device detection, and required USB-serial driver.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchPorts(false)}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300 font-semibold text-[11px] transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Retry Scan</span>
            </button>
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded border border-amber-300 font-semibold text-[11px] transition-colors"
            >
              {showDiagnostics ? 'Hide Checklist' : 'Windows Checklist'}
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Physical Connection Controls Bar */}
      <div className="px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Physical Receiver COM Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider">
            <Plug className="w-3.5 h-3.5 text-sky-600" />
            <span>Physical COM Receiver:</span>
          </div>

          {/* Port Dropdown */}
          <div className="flex items-center gap-1.5">
            <label className="text-slate-500 font-medium">COM Port:</label>
            <select
              value={selectedPort}
              onChange={(e) => {
                setSelectedPort(e.target.value);
                setErrorDetails(null);
              }}
              disabled={connectionState.isConnected || isConnecting}
              className="bg-slate-50 border border-slate-300 text-slate-800 font-mono text-xs rounded px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60 max-w-xs"
            >
              {availablePorts.length === 0 ? (
                <option value="">No Physical COM Ports Detected</option>
              ) : (
                availablePorts.map((p) => {
                  const metaParts = [];
                  if (p.friendlyName && p.friendlyName !== p.path) metaParts.push(p.friendlyName);
                  else if (p.manufacturer) metaParts.push(p.manufacturer);
                  if (p.vendorId && p.productId) metaParts.push(`VID:${p.vendorId} PID:${p.productId}`);

                  const label = metaParts.length > 0 ? `${p.path} — ${metaParts.join(' ')}` : p.path;
                  return (
                    <option key={p.path} value={p.path}>
                      {label}
                    </option>
                  );
                })
              )}
            </select>

            {/* Refresh Ports Button */}
            <button
              onClick={() => fetchPorts(false)}
              disabled={connectionState.isConnected || isRefreshing || isConnecting}
              title="Refresh available Windows COM ports"
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 disabled:opacity-50 transition-colors font-medium text-[11px]"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Ports</span>
            </button>
          </div>

          {/* Baud Rate Dropdown */}
          <div className="flex items-center gap-1.5">
            <label className="text-slate-500 font-medium">Baud Rate:</label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={connectionState.isConnected || isConnecting}
              className="bg-slate-50 border border-slate-300 text-slate-800 font-mono text-xs rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
            >
              {baudRates.map((b) => (
                <option key={b} value={b}>
                  {b} {b === 115200 ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Connect / Disconnect Action Button */}
          {!connectionState.isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting || !selectedPort}
              className="flex items-center gap-1.5 px-3.5 py-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isConnecting ? 'OPENING...' : 'CONNECT'}</span>
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded shadow-xs transition-colors cursor-pointer"
            >
              <Unplug className="w-3.5 h-3.5" />
              <span>DISCONNECT</span>
            </button>
          )}

          {/* Real Physical Port Status vs Telemetry Data Status */}
          {connectionState.isConnected && (
            <div className="flex items-center gap-2 pl-2">
              {/* 1. Hardware Port Status */}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-300 rounded text-emerald-800 text-[11px] font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  PORT OPEN: {connectionState.port} @ {connectionState.baudRate}
                </span>
              </div>

              {/* 2. Telemetry Packet Reception Status */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                  connectionState.signalStatus === 'RECEIVING'
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-amber-50 border-amber-300 text-amber-800'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>
                  {connectionState.signalStatus === 'RECEIVING'
                    ? `RECEIVING DATA (${connectionState.packetRate} Hz)`
                    : `AWAITING TELEMETRY (${connectionState.totalPackets} Packets | ${connectionState.totalBytesReceived} Bytes)`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Diagnostics Panel Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-semibold transition-colors cursor-pointer ${
              showDiagnostics
                ? 'bg-sky-50 text-sky-800 border-sky-300'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-sky-600" />
            <span>Windows Diagnostics</span>
            <span className="ml-1 px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px] font-mono">
              {availablePorts.length} {availablePorts.length === 1 ? 'Port' : 'Ports'}
            </span>
            {showDiagnostics ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* 4. Windows Device Detection Diagnostics Panel (Collapsible / Expandable) */}
      {showDiagnostics && (
        <div className="bg-slate-50 border-t border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                WINDOWS PHYSICAL DEVICE DETECTION DIAGNOSTICS
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Native Win32 SerialPort Subsystem • 100% Offline
            </span>
          </div>

          {/* Diagnostics Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            {/* Metric 1: Physical Ports Count */}
            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Physical Ports</span>
              <div className="text-lg font-black font-mono text-slate-800 mt-0.5">
                {availablePorts.length}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Bluetooth Excluded</span>
            </div>

            {/* Metric 2: Selected COM Port */}
            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Selected Port</span>
              <div className="text-lg font-black font-mono text-sky-700 mt-0.5">
                {selectedPort || 'None'}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Baud: {baudRate}</span>
            </div>

            {/* Metric 3: Connection State */}
            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Port State</span>
              <div className={`text-base font-black font-mono mt-0.5 ${
                connectionState.isConnected ? 'text-emerald-600' :
                connectionState.status === 'OPENING' ? 'text-amber-600' :
                connectionState.status === 'ERROR' ? 'text-rose-600' : 'text-slate-600'
              }`}>
                {connectionState.status}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">OS Serial Handle</span>
            </div>

            {/* Metric 4: Total Bytes Received */}
            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Bytes Received</span>
              <div className="text-lg font-black font-mono text-slate-800 mt-0.5">
                {connectionState.totalBytesReceived.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Raw Stream Volume</span>
            </div>

            {/* Metric 5: Valid Telemetry Packets */}
            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Parsed Packets</span>
              <div className="text-lg font-black font-mono text-slate-800 mt-0.5">
                {connectionState.totalPackets}
              </div>
              <span className="text-[10px] text-slate-500 font-medium">
                {connectionState.parseErrorCount > 0 ? `${connectionState.parseErrorCount} parse errors` : 'Zero errors'}
              </span>
            </div>

            {/* Metric 6: Last Packet Timestamp */}
            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Last Packet Time</span>
              <div className="text-base font-black font-mono text-slate-800 mt-0.5 truncate">
                {connectionState.lastPacketTimestamp || '--:--:--'}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {connectionState.lastPacketAgeSec < 90 ? `Age: ${connectionState.lastPacketAgeSec.toFixed(1)}s` : 'No recent pkt'}
              </span>
            </div>
          </div>

          {/* Action Recommendation Bar */}
          <div className="bg-white p-3 rounded border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-600 shrink-0" />
              <div>
                <span className="text-slate-500 font-medium">Suggested Next Action: </span>
                <span className="font-semibold text-slate-800">{getSuggestedAction()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPorts(false)}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 font-medium text-xs transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Re-scan Windows Ports</span>
              </button>
            </div>
          </div>

          {/* Detected Ports Device Metadata Table */}
          {availablePorts.length > 0 && (
            <div className="bg-white rounded border border-slate-200 overflow-hidden text-xs">
              <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between">
                <span>Detected Windows Physical Ports & Hardware Metadata</span>
                <span className="text-[10px] font-normal text-slate-500">Enumerated via Windows SetupAPI</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase">
                    <tr>
                      <th className="px-3.5 py-2">Port Path</th>
                      <th className="px-3.5 py-2">Friendly Name</th>
                      <th className="px-3.5 py-2">Manufacturer</th>
                      <th className="px-3.5 py-2">Vendor ID</th>
                      <th className="px-3.5 py-2">Product ID</th>
                      <th className="px-3.5 py-2">Serial Number</th>
                      <th className="px-3.5 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {availablePorts.map((p) => {
                      const isSelected = p.path === selectedPort;
                      return (
                        <tr key={p.path} className={isSelected ? 'bg-sky-50/50' : 'hover:bg-slate-50'}>
                          <td className="px-3.5 py-2 font-bold text-sky-800">{p.path}</td>
                          <td className="px-3.5 py-2 text-slate-800">{p.friendlyName || p.path}</td>
                          <td className="px-3.5 py-2 text-slate-600">{p.manufacturer || '--'}</td>
                          <td className="px-3.5 py-2 text-slate-600">{p.vendorId ? `0x${p.vendorId}` : '--'}</td>
                          <td className="px-3.5 py-2 text-slate-600">{p.productId ? `0x${p.productId}` : '--'}</td>
                          <td className="px-3.5 py-2 text-slate-500 text-[10px] truncate max-w-xs">{p.serialNumber || '--'}</td>
                          <td className="px-3.5 py-2 text-right">
                            <button
                              onClick={() => {
                                setSelectedPort(p.path);
                                setErrorDetails(null);
                              }}
                              disabled={connectionState.isConnected}
                              className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                                isSelected
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Windows Checklist (Required when 0 ports detected or expanded) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded p-4 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                {availablePorts.length === 0
                  ? 'Windows reports zero physical serial ports — The issue is below the application layer until device detection is confirmed.'
                  : 'Windows Device Detection & Troubleshooting Guide'}
              </span>
            </div>

            <p className="text-[11px] text-amber-800 leading-relaxed">
              If your CanSat receiver is plugged into USB but does not appear in the application, follow this Windows checklist:
            </p>

            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-amber-950 font-medium pl-1 leading-relaxed">
              <li>
                <strong>Open Device Manager:</strong> Press <code className="bg-amber-100 px-1 py-0.5 rounded">Win + X</code> and click <strong>Device Manager</strong> (or press <code className="bg-amber-100 px-1 py-0.5 rounded">Win + R</code>, type <code className="bg-amber-100 px-1 py-0.5 rounded">devmgmt.msc</code>, and press Enter).
              </li>
              <li>
                <strong>Inspect Device Categories:</strong> Expand <strong>Ports (COM &amp; LPT)</strong>, <strong>Other devices</strong>, and <strong>Universal Serial Bus controllers</strong>.
              </li>
              <li>
                <strong>Look for Warning Icons:</strong> Check if an unknown device or USB-to-UART adapter has a yellow exclamation warning icon (⚠️).
              </li>
              <li>
                <strong>Identify Chipset Hardware IDs:</strong> Right-click the receiver device &rarr; <strong>Properties</strong> &rarr; <strong>Details</strong> tab &rarr; select <strong>Hardware Ids</strong> from the dropdown. Look for:
                <ul className="list-disc list-inside pl-4 text-amber-900 font-mono text-[10px] space-y-0.5 pt-0.5">
                  <li>Silicon Labs CP2102/CP2102N: <code className="bg-amber-100 px-1 rounded">VID_10C4 &amp; PID_EA60</code></li>
                  <li>WCH CH340 / CH341: <code className="bg-amber-100 px-1 rounded">VID_1A86 &amp; PID_7523</code></li>
                  <li>FTDI FT232R: <code className="bg-amber-100 px-1 rounded">VID_0403 &amp; PID_6001</code></li>
                  <li>Espressif ESP32-S3 / C3 Native USB: <code className="bg-amber-100 px-1 rounded">VID_303A &amp; PID_1001</code></li>
                </ul>
              </li>
              <li>
                <strong>Install Official Driver:</strong> If the device is marked unknown or driver missing, install only the official USB-UART driver from the chipset manufacturer (e.g., Silicon Labs CP210x VCP Driver or WCH CH341SER).
              </li>
              <li>
                <strong>Reconnect and Refresh:</strong> Unplug the USB cable, plug it firmly into a direct laptop USB port (avoid unpowered passive hubs), and click <strong>Refresh Ports</strong> above.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
