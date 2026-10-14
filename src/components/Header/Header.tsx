import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { AlertCircle, FolderOpen, Radio, Settings, ShieldCheck, Unplug } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const { connectionState } = useTelemetryStore();
  const [timeStr, setTimeStr] = useState<string>('');
  const [utcTimeStr, setUtcTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString());
      setUtcTimeStr(now.toISOString().substring(11, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenFolder = () => {
    if (window.electronAPI) {
      window.electronAPI.openLogFolder();
    }
  };

  const getStatusBadge = () => {
    if (connectionState.status === 'OPENING') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>OPENING PORT...</span>
        </span>
      );
    }

    if (connectionState.status === 'ERROR' || (!connectionState.isConnected && connectionState.lastError)) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-300">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>PORT ERROR</span>
        </span>
      );
    }

    if (!connectionState.isConnected) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
          <Unplug className="w-3.5 h-3.5 text-slate-400" />
          <span>PORT DISCONNECTED</span>
        </span>
      );
    }

    // Physical Serial Port is Connected - distinguish port open vs telemetry arrival
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-led-pulse" />
          <span>PORT OPEN ({connectionState.port})</span>
        </span>

        {connectionState.signalStatus === 'RECEIVING' ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-300">
            <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
            <span>RECEIVING ({connectionState.packetRate} Hz)</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <Radio className="w-3.5 h-3.5 text-amber-600" />
            <span>AWAITING TELEMETRY</span>
          </span>
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-2.5 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: TEAM INDRA Branding & Mission Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-950 text-white flex items-center justify-center font-black tracking-wider shadow-sm border border-sky-800">
            <Radio className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">
                TEAM INDRA
              </h1>
              <span className="text-base font-semibold text-slate-600">CanSat Ground Station</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
                100% Offline
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">AEROSPACE MISSION CONTROL & TELEMETRY DASHBOARD</p>
          </div>
        </div>

        {/* Center: System Status Summary */}
        <div className="flex items-center gap-6 bg-slate-50 px-4 py-1.5 rounded-lg border border-slate-200">
          {getStatusBadge()}

          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-600">
            <div>
              <span className="text-slate-400 uppercase text-[10px] block font-sans">Port:</span>
              <span className="font-semibold text-slate-800">{connectionState.port}</span>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <span className="text-slate-400 uppercase text-[10px] block font-sans">Baud:</span>
              <span className="font-semibold text-slate-800">{connectionState.baudRate}</span>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <span className="text-slate-400 uppercase text-[10px] block font-sans">Rate:</span>
              <span className="font-semibold text-sky-600">{connectionState.packetRate} Hz</span>
            </div>
          </div>
        </div>

        {/* Right: Clock & Action Buttons */}
        <div className="flex items-center gap-3">
          <div className="text-right font-mono hidden lg:block">
            <div className="text-sm font-bold text-slate-800 leading-tight">{timeStr}</div>
            <div className="text-[10px] text-slate-500 font-medium">{utcTimeStr}</div>
          </div>

          <button
            onClick={handleOpenFolder}
            title="Open Offline CSV Logs Directory"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>Logs</span>
          </button>

          <button
            onClick={onOpenSettings}
            title="Ground Station Settings"
            className="p-1.5 text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>
    </header>
  );
};
