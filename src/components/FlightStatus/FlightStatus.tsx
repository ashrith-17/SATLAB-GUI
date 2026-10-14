import React from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { FlightState } from '../../types/telemetry';
import { ArrowDown, ArrowUp, Flag, CheckCircle2, Rocket } from 'lucide-react';

export const FlightStatus: React.FC = () => {
  const { latestTelemetry } = useTelemetryStore();
  const currentState: FlightState = latestTelemetry?.flightState || 'PRE-LAUNCH';

  const states: { key: FlightState; label: string; icon: React.ReactNode }[] = [
    { key: 'PRE-LAUNCH', label: 'PRE-LAUNCH', icon: <Rocket className="w-3.5 h-3.5" /> },
    { key: 'ASCENT', label: 'ASCENT', icon: <ArrowUp className="w-3.5 h-3.5" /> },
    { key: 'DESCENT', label: 'DESCENT', icon: <ArrowDown className="w-3.5 h-3.5" /> },
    { key: 'LANDED', label: 'LANDED', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            FLIGHT STATUS:
          </span>
        </div>

        {/* Phase Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 max-w-2xl">
          {states.map((s) => {
            const isActive = currentState === s.key;
            return (
              <div
                key={s.key}
                className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded border text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white border-sky-700 shadow-xs ring-2 ring-sky-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {s.icon}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
