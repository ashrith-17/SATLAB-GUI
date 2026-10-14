import React from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { AlertTriangle, Radio } from 'lucide-react';

export const CommunicationPanel: React.FC = () => {
  const { connectionState, latestTelemetry } = useTelemetryStore();

  const isReceiving = connectionState.signalStatus === 'RECEIVING';
  const isNoSignal = connectionState.signalStatus === 'NO SIGNAL';

  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            COMMUNICATION MONITOR
          </h3>
        </div>

        {/* Signal Status Badge */}
        {isReceiving && (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            RECEIVING
          </span>
        )}
        {isNoSignal && (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1 animate-led-pulse">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            NO SIGNAL
          </span>
        )}
        {!isReceiving && !isNoSignal && (
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
            DISCONNECTED
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Packet Rate */}
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <span className="text-[10px] text-slate-400 font-sans block font-semibold">
            PACKET RATE
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-lg font-black font-mono text-slate-800">
              {connectionState.packetRate}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">pkt/s</span>
          </div>
        </div>

        {/* Packet Age */}
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <span className="text-[10px] text-slate-400 font-sans block font-semibold">
            LAST PACKET AGE
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-lg font-black font-mono ${
                connectionState.lastPacketAgeSec > 2 ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {connectionState.lastPacketAgeSec.toFixed(1)}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">sec</span>
          </div>
        </div>

        {/* Total Received */}
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <span className="text-[10px] text-slate-400 font-sans block font-semibold">
            TOTAL PACKETS
          </span>
          <div className="text-lg font-black font-mono text-slate-800 mt-0.5">
            {connectionState.totalPackets}
          </div>
        </div>

        {/* Lost Packets */}
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
          <span className="text-[10px] text-slate-400 font-sans block font-semibold">
            LOST PACKETS
          </span>
          <div className="text-lg font-black font-mono text-rose-600 mt-0.5">
            {connectionState.lostPackets}
          </div>
        </div>
      </div>

      {/* RSSI Signal Indicator */}
      <div className="mt-3 bg-slate-50 p-2.5 rounded border border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <Radio className="w-3.5 h-3.5 text-slate-500" />
          <span>RSSI Strength:</span>
        </div>
        <span className="font-mono font-bold text-slate-800">
          {latestTelemetry?.rssi !== null && latestTelemetry?.rssi !== undefined
            ? `${latestTelemetry.rssi} dBm`
            : '--'}
        </span>
      </div>
    </div>
  );
};
