import React, { useEffect, useRef, useState } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { ArrowDown, Copy, Pause, Play, Search, Terminal, Trash2 } from 'lucide-react';

export const RawLog: React.FC = () => {
  const { rawLogLines, isRawLogPaused, toggleRawLogPause, clearRawLog } = useTelemetryStore();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current && !isRawLogPaused) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [rawLogLines, autoScroll, isRawLogPaused]);

  const filteredLines = rawLogLines.filter((line) =>
    searchTerm ? line.toLowerCase().includes(searchTerm.toLowerCase()) : true
  );

  const handleCopy = () => {
    const content = rawLogLines.join('\n');
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col">
      {/* Terminal Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            RAW TELEMETRY STREAM LOG
          </h3>
          <span className="text-[10px] font-mono text-slate-400">
            ({filteredLines.length} lines in buffer)
          </span>
          {isRawLogPaused && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
              DISPLAY PAUSED (RECEIVING IN BACKGROUND)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1.5" />
            <input
              type="text"
              placeholder="Filter stream..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-xs font-mono rounded pl-7 pr-2 py-0.5 w-36 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Auto-scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border font-semibold ${
              autoScroll
                ? 'bg-sky-50 text-sky-700 border-sky-300'
                : 'bg-slate-50 text-slate-500 border-slate-300'
            }`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll paused'}
          >
            <ArrowDown className="w-3 h-3" />
            <span>AUTO-SCROLL</span>
          </button>

          {/* Pause / Resume Feed */}
          <button
            onClick={toggleRawLogPause}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs border font-semibold ${
              isRawLogPaused
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-slate-50 text-slate-700 border-slate-300'
            }`}
            title={isRawLogPaused ? 'Resume Terminal Feed' : 'Pause Terminal Feed'}
          >
            {isRawLogPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isRawLogPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title="Copy Raw Stream to Clipboard"
            className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-300"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Clear Button */}
          <button
            onClick={clearRawLog}
            title="Clear Stream Buffer"
            className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-300"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={logContainerRef}
        className="bg-slate-900 text-emerald-400 p-2.5 rounded font-mono text-[11px] overflow-y-auto space-y-0.5 h-[130px] select-text shadow-inner"
      >
        {filteredLines.length === 0 ? (
          <div className="text-slate-500 italic text-center py-8">
            Waiting for serial telemetry packets...
          </div>
        ) : (
          filteredLines.map((line, idx) => (
            <div key={idx} className="leading-snug hover:bg-slate-800/70 px-1 rounded flex">
              <span className="text-slate-500 select-none mr-2 shrink-0">
                [{String(idx + 1).padStart(3, '0')}]
              </span>
              <span className="break-all">{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
