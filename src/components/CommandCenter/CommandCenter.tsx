import React, { useState } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { CommandItem, CommandLog } from '../../types/telemetry';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Radio,
  Send,
  ShieldAlert,
  Terminal,
} from 'lucide-react';

export const CommandCenter: React.FC = () => {
  const { predefinedCommands, commandLogs, addCommandLog, connectionState } = useTelemetryStore();
  const [pendingCriticalCmd, setPendingCriticalCmd] = useState<CommandItem | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);

  const isConnected = connectionState.isConnected;

  const handleCommandClick = (cmd: CommandItem) => {
    if (!isConnected) return;
    if (cmd.isCritical) {
      setPendingCriticalCmd(cmd);
    } else {
      executeCommand(cmd);
    }
  };

  const executeCommand = async (cmd: CommandItem) => {
    setPendingCriticalCmd(null);
    if (!window.electronAPI) return;

    setIsSending(true);
    try {
      const logResult: CommandLog = await window.electronAPI.sendCommand(cmd);
      addCommandLog(logResult);
    } catch (err) {
      console.error('Failed to send command:', err);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACKNOWLEDGED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>ACK</span>
          </span>
        );
      case 'TIMEOUT':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>TIMEOUT</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
            <AlertOctagon className="w-3 h-3 text-rose-600" />
            <span>FAILED</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded animate-pulse">
            <Send className="w-3 h-3 text-sky-600" />
            <span>TRANSMITTING</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            FLIGHT COMMAND CENTER
          </h3>
          <span className="text-[10px] text-slate-400 font-medium">
            (Separated Uplink Controls)
          </span>
        </div>

        {!isConnected ? (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
            <Radio className="w-3 h-3 text-amber-600" />
            UPLINK LOCKED (DISCONNECTED)
          </span>
        ) : (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            RF UPLINK READY
          </span>
        )}
      </div>

      {/* Main Command Bar & History Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Command Buttons Palette (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Flight Control Sequences
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {predefinedCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => handleCommandClick(cmd)}
                  disabled={!isConnected || isSending}
                  title={`${cmd.name}: ${cmd.description} (${cmd.payload})`}
                  className={`flex flex-col items-start justify-center p-2 rounded text-left transition-all border shadow-2xs active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
                    cmd.isCritical
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300 hover:border-rose-400'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold truncate">{cmd.name}</span>
                    {cmd.isCritical && (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0 ml-1" />
                    )}
                  </div>
                  <span className="font-mono text-[9px] text-slate-500 mt-0.5 truncate max-w-full">
                    {cmd.payload}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
            <span className="font-semibold text-slate-500">Notice:</span>
            <span>Critical flight commands (Parachute / Abort) enforce confirmation modal.</span>
          </div>
        </div>

        {/* Command History & Acknowledgement Stream (4 cols) */}
        <div className="lg:col-span-4 bg-slate-50 rounded border border-slate-200 p-2 flex flex-col h-[130px]">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            <span>Uplink Log & ACKs</span>
            <span className="font-mono">{commandLogs.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
            {commandLogs.length === 0 ? (
              <div className="text-center py-6 text-[11px] text-slate-400 font-mono">
                No commands transmitted yet.
              </div>
            ) : (
              commandLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white p-1.5 rounded border border-slate-200 text-xs flex items-center justify-between shadow-2xs"
                >
                  <div className="truncate mr-2">
                    <div className="font-bold text-slate-800 text-[11px] truncate">
                      {log.commandName}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">{log.timestamp}</div>
                  </div>
                  <div className="shrink-0">{getStatusBadge(log.status)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Safety Confirmation Modal for Critical Commands */}
      {pendingCriticalCmd && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-rose-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 leading-tight">
                  ⚠ CONFIRM CRITICAL COMMAND
                </h4>
                <p className="text-xs text-rose-600 font-medium">HIGH IMPACT FLIGHT ACTION</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3.5 mb-4 text-xs text-slate-700">
              Are you sure you want to transmit critical command:
              <div className="text-base font-black text-rose-900 font-mono my-1">
                "{pendingCriticalCmd.name}" ({pendingCriticalCmd.payload})
              </div>
              <p className="text-[11px] text-slate-600 mt-1">{pendingCriticalCmd.description}</p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setPendingCriticalCmd(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={() => executeCommand(pendingCriticalCmd)}
                className="px-5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs shadow-md transition-colors"
              >
                CONFIRM & TRANSMIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
