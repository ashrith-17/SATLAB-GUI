import React, { useState } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { GroundStationConfig } from '../../types/telemetry';
import { Save, Settings, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { config, setConfig } = useTelemetryStore();
  const [formData, setFormData] = useState<GroundStationConfig>(config);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!window.electronAPI) return;
    try {
      const updated = await window.electronAPI.saveConfig(formData);
      setConfig(updated);
      onClose();
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-bold">Ground Station Local Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* GS Location Coordinates */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
              Ground Station Location (Haversine Reference)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 font-semibold block mb-1">GS Latitude (°):</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.gsLatitude}
                  onChange={(e) =>
                    setFormData({ ...formData, gsLatitude: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-slate-500 font-semibold block mb-1">GS Longitude (°):</label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.gsLongitude}
                  onChange={(e) =>
                    setFormData({ ...formData, gsLongitude: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* DPS310 Reference Pressure P0 & Barometric Formula Configuration */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              DPS310 Barometric Altitude Calibration (P₀ Reference)
            </h4>
            <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
              Altitude estimation uses standard ISA formula: <code className="font-mono bg-white px-1 py-0.5 rounded border">h = 44330 × [1 - (P/P₀)^0.1903]</code>.
              Ambient weather, local weather fronts, and temperature affect accuracy. Calibrate P₀ at the launch site to current measured pressure for accurate AGL (Above Ground Level) altitude.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">
                  Reference Pressure P₀ (hPa):
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.05"
                    min="500"
                    max="1200"
                    value={formData.referencePressureHpa || 1013.25}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        referencePressureHpa: parseFloat(e.target.value) || 1013.25,
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const latest = useTelemetryStore.getState().latestTelemetry;
                      if (latest && latest.pressure > 0) {
                        setFormData({
                          ...formData,
                          referencePressureHpa: parseFloat(latest.pressure.toFixed(2)),
                        });
                      } else {
                        alert('No pressure telemetry received yet to calibrate.');
                      }
                    }}
                    title="Calibrate P0 using current measured DPS310 pressure"
                    className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded text-[10px] shrink-0 transition-colors"
                  >
                    CALIBRATE
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Standard ISA Sea-Level: 1013.25 hPa</span>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">
                  Primary Altitude Source:
                </label>
                <select
                  value={formData.altitudeSource || 'ONBOARD'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      altitudeSource: e.target.value as 'ONBOARD' | 'DPS310_CALCULATED',
                    })
                  }
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="ONBOARD">Onboard Flight Software (Transmitted)</option>
                  <option value="DPS310_CALCULATED">Ground Station Barometric Estimate (P₀)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Select agreed primary source for summary cards
                </span>
              </div>
            </div>
          </div>

          {/* Performance & Graph Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 font-semibold block mb-1">
                Graph Rolling History Points:
              </label>
              <input
                type="number"
                min="100"
                max="2000"
                value={formData.maxGraphPoints}
                onChange={(e) =>
                  setFormData({ ...formData, maxGraphPoints: parseInt(e.target.value, 10) || 500 })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Recommended: 500-1000</span>
            </div>

            <div>
              <label className="text-slate-600 font-semibold block mb-1">
                Signal Timeout Threshold (ms):
              </label>
              <input
                type="number"
                min="1000"
                max="10000"
                value={formData.packetTimeoutMs}
                onChange={(e) =>
                  setFormData({ ...formData, packetTimeoutMs: parseInt(e.target.value, 10) || 2500 })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Default: 2500 ms</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded text-xs shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>SAVE CONFIGURATION</span>
          </button>
        </div>
      </div>
    </div>
  );
};
