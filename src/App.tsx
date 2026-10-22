import React, { useEffect, useState } from 'react';
import { useTelemetryStore } from './store/telemetryStore';
import { Header } from './components/Header/Header';
import { SerialPanel } from './components/SerialPanel/SerialPanel';
import { FlightStatus } from './components/FlightStatus/FlightStatus';
import { TelemetrySummaryCards } from './components/TelemetryCards/TelemetryCards';
import { TelemetryGraphs } from './components/Graphs/TelemetryGraphs';
import { CanSatOrientation } from './components/Orientation/CanSatOrientation';
import { GPSPanel } from './components/GPSPanel/GPSPanel';
import { CommandCenter } from './components/CommandCenter/CommandCenter';
import { RawLog } from './components/RawLog/RawLog';
import { SettingsModal } from './components/Settings/SettingsModal';
import { INAPowerModule } from './components/INAPowerModule/INAPowerModule';

export const App: React.FC = () => {
  const {
    addTelemetry,
    addRawLine,
    setConnectionState,
    updateCommandLog,
    addSystemLog,
    setConfig,
    setPredefinedCommands,
  } = useTelemetryStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Load initial configs & predefined commands from Main Process
    window.electronAPI.getConfig().then((cfg) => setConfig(cfg));
    window.electronAPI.getPredefinedCommands().then((cmds) => setPredefinedCommands(cmds));

    // Register Electron IPC Listeners
    const unsubTelemetry = window.electronAPI.onTelemetryData((data) => {
      addTelemetry(data);
    });

    const unsubRaw = window.electronAPI.onRawLine((line) => {
      addRawLine(line);
    });

    const unsubConn = window.electronAPI.onConnectionStatus((status) => {
      setConnectionState(status);
    });

    const unsubCmd = window.electronAPI.onCommandStatus((log) => {
      updateCommandLog(log);
    });

    const unsubSys = window.electronAPI.onSystemLog((msg) => {
      addSystemLog(msg);
    });

    return () => {
      unsubTelemetry();
      unsubRaw();
      unsubConn();
      unsubCmd();
      unsubSys();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none text-slate-900">
      {/* Top Application Header Bar */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Serial Hardware & Connection Bar */}
      <SerialPanel />

      {/* Flight Phase Banner (PRE-LAUNCH | ASCENT | DESCENT | LANDED) */}
      <FlightStatus />

      {/* Main Two-Column Ground Station Dashboard - Fully Scrollable */}
      <main className="flex-1 p-3.5 space-y-3.5 pb-12 w-full">
        {/* TWO-COLUMN GRID:
            LEFT: 6 Live Graphs (2-column x 3-row)
            RIGHT: Telemetry Summary Cards + CanSat Orientation + GPS & Communication Link */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* LEFT SIDE: 6 LIVE GRAPHS (2 cols x 3 rows) */}
          <section className="lg:col-span-7 xl:col-span-7 flex flex-col">
            <TelemetryGraphs />
          </section>

          {/* RIGHT SIDE: TELEMETRY SUMMARY, POWER MONITOR, 3D ORIENTATION, GPS */}
          <section className="lg:col-span-5 xl:col-span-5 flex flex-col space-y-3.5">
            {/* 1. Telemetry Summary Cards */}
            <TelemetrySummaryCards />

            {/* 2. Dedicated INA219 / INA226 Electrical Power Monitoring Module */}
            <INAPowerModule />

            {/* 3. Live CanSat Orientation (3D/Attitude Model) */}
            <CanSatOrientation />

            {/* 4. GPS & Flight Separation */}
            <GPSPanel />
          </section>
        </div>

        {/* BOTTOM SECTION 1: COMMAND CENTER */}
        <section>
          <CommandCenter />
        </section>

        {/* BOTTOM SECTION 2: RAW TELEMETRY LOG */}
        <section>
          <RawLog />
        </section>
      </main>

      {/* Offline Configuration Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default App;
