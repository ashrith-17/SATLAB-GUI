import React, { useEffect, useRef, useState } from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { Compass, RotateCw, RefreshCw } from 'lucide-react';

// Static CanSat 3D Model Dimensions
const CYLINDER_RADIUS = 42;
const CYLINDER_HALF_HEIGHT = 65;
const NUM_SLICES = 24;

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Point2D {
  x: number;
  y: number;
  depth: number;
}

// Pre-allocate static cylinder vertices once outside React render lifecycle
const TOP_POINTS_3D: Point3D[] = [];
const BOTTOM_POINTS_3D: Point3D[] = [];

for (let i = 0; i < NUM_SLICES; i++) {
  const angle = (i * 2 * Math.PI) / NUM_SLICES;
  const x = CYLINDER_RADIUS * Math.cos(angle);
  const y = CYLINDER_RADIUS * Math.sin(angle);
  // Body Z is the vertical cylindrical axis (top cap at +Z, bottom cap at -Z)
  TOP_POINTS_3D.push({ x, y, z: CYLINDER_HALF_HEIGHT });
  BOTTOM_POINTS_3D.push({ x, y, z: -CYLINDER_HALF_HEIGHT });
}

// Camera perspective parameters
const CAMERA_PITCH = (22 * Math.PI) / 180; // Elevation angle looking slightly downward at CanSat
const COS_CAM = Math.cos(CAMERA_PITCH);
const SIN_CAM = Math.sin(CAMERA_PITCH);
const CAMERA_DISTANCE = 340;

/**
 * Standard Tait-Bryan Z-Y'-X'' Aerospace Euler Rotation + Perspective Camera Projection:
 * 1. Roll (phi) around Body X axis
 * 2. Pitch (theta) around Body Y axis
 * 3. Yaw (psi) around World Z axis (compass heading / spin about vertical cylinder axis)
 * 4. Perspective projection onto 2D canvas
 */
function rotateAndProjectPoint(
  p: Point3D,
  phi: number,
  theta: number,
  psi: number,
  cx: number,
  cy: number
): Point2D {
  // 1. Roll around Body X
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const x1 = p.x;
  const y1 = p.y * cosPhi - p.z * sinPhi;
  const z1 = p.y * sinPhi + p.z * cosPhi;

  // 2. Pitch around Body Y
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const x2 = x1 * cosTheta + z1 * sinTheta;
  const y2 = y1;
  const z2 = -x1 * sinTheta + z1 * cosTheta;

  // 3. Yaw around World Z (spins about vertical axis)
  const cosPsi = Math.cos(psi);
  const sinPsi = Math.sin(psi);
  const x3 = x2 * cosPsi - y2 * sinPsi;
  const y3 = x2 * sinPsi + y2 * cosPsi;
  const z3 = z2;

  // 4. Perspective camera coordinate transformation:
  // Looking down at CanSat from elevation angle:
  // +Z_world (top of CanSat) points upwards on canvas (-Y_cam)
  // +Y_world tilts toward viewer with factor sin(elevation)
  const xCam = x3;
  const yCam = -z3 * COS_CAM + y3 * SIN_CAM;
  const zCam = z3 * SIN_CAM + y3 * COS_CAM;

  // 5. Perspective projection
  const factor = CAMERA_DISTANCE / (CAMERA_DISTANCE + zCam);

  return {
    x: cx + xCam * factor,
    y: cy + yCam * factor,
    depth: zCam,
  };
}

export const CanSatOrientation: React.FC = () => {
  const { latestTelemetry, connectionState, config } = useTelemetryStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Manual visual zero offset reference
  const [zeroOffset, setZeroOffset] = useState<{ roll: number; pitch: number; yaw: number }>({
    roll: 0,
    pitch: 0,
    yaw: 0,
  });

  // Responsive ResizeObserver for canvas dimensions with proper cleanup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 320;
      const height = canvas.clientHeight || 250;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  const hasTelemetry =
    latestTelemetry !== null &&
    typeof latestTelemetry.roll === 'number' &&
    !isNaN(latestTelemetry.roll) &&
    typeof latestTelemetry.pitch === 'number' &&
    !isNaN(latestTelemetry.pitch) &&
    typeof latestTelemetry.yaw === 'number' &&
    !isNaN(latestTelemetry.yaw);

  const isConnected = connectionState.isConnected;
  const timeoutSec = (config.packetTimeoutMs || 2500) / 1000;
  const isStale =
    isConnected &&
    (connectionState.signalStatus === 'NO SIGNAL' ||
      connectionState.lastPacketAgeSec > timeoutSec);

  const isDataAvailable = isConnected && hasTelemetry;

  // Target orientation (updated whenever valid telemetry arrives, rejected if corrupted)
  const targetRef = useRef<{ roll: number; pitch: number; yaw: number }>({
    roll: 0,
    pitch: 0,
    yaw: 0,
  });

  // Current interpolated orientation (updated smoothly per animation frame)
  const currentRef = useRef<{ roll: number; pitch: number; yaw: number }>({
    roll: 0,
    pitch: 0,
    yaw: 0,
  });

  // Smooth numeric angle display state (throttled for visual clarity)
  const [displayAngles, setDisplayAngles] = useState<{ roll: number; pitch: number; yaw: number }>({
    roll: 0,
    pitch: 0,
    yaw: 0,
  });

  // Update target orientation from validated incoming telemetry
  useEffect(() => {
    if (!hasTelemetry || !isConnected) return;

    const rawRoll = latestTelemetry.roll;
    const rawPitch = latestTelemetry.pitch;
    const rawYaw = latestTelemetry.yaw;

    // Reject non-numeric or extreme unphysical packet values
    if (!isFinite(rawRoll) || !isFinite(rawPitch) || !isFinite(rawYaw)) return;
    if (Math.abs(rawRoll) > 360 || Math.abs(rawPitch) > 360 || Math.abs(rawYaw) > 720) return;

    const targetRoll = rawRoll - zeroOffset.roll;
    const targetPitch = rawPitch - zeroOffset.pitch;
    const targetYaw = ((rawYaw - zeroOffset.yaw) % 360 + 360) % 360;

    targetRef.current = {
      roll: targetRoll,
      pitch: targetPitch,
      yaw: targetYaw,
    };
  }, [hasTelemetry, isConnected, latestTelemetry?.roll, latestTelemetry?.pitch, latestTelemetry?.yaw, zeroOffset]);

  const handleResetZero = () => {
    if (hasTelemetry && latestTelemetry) {
      setZeroOffset({
        roll: latestTelemetry.roll,
        pitch: latestTelemetry.pitch,
        yaw: latestTelemetry.yaw,
      });
    }
  };

  const handleClearOffset = () => {
    setZeroOffset({ roll: 0, pitch: 0, yaw: 0 });
  };

  // Dedicated 60 FPS animation loop decoupled from React state and serial packet bursts
  useEffect(() => {
    let animId: number;
    let lastDisplayUpdateTime = 0;

    const render = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const target = targetRef.current;
      const current = currentRef.current;

      // Tunable exponential low-pass smoothing factor: 0.22 provides ~50ms decay with zero noticeable lag
      const alpha = 0.22;

      // 1. Shortest-path Yaw wraparound interpolation (359° to 1° rotates +2°)
      const deltaYaw = ((target.yaw - current.yaw + 540) % 360) - 180;
      if (Math.abs(deltaYaw) < 0.01) {
        current.yaw = target.yaw;
      } else {
        current.yaw = ((current.yaw + deltaYaw * alpha) % 360 + 360) % 360;
      }

      // 2. Pitch interpolation
      const deltaPitch = target.pitch - current.pitch;
      if (Math.abs(deltaPitch) < 0.01) {
        current.pitch = target.pitch;
      } else {
        current.pitch += deltaPitch * alpha;
      }

      // 3. Roll interpolation
      const deltaRoll = target.roll - current.roll;
      if (Math.abs(deltaRoll) < 0.01) {
        current.roll = target.roll;
      } else {
        current.roll += deltaRoll * alpha;
      }

      // Update numeric angle display at ~15 Hz to eliminate React re-render overhead
      if (time - lastDisplayUpdateTime > 66) {
        setDisplayAngles({
          roll: current.roll,
          pitch: current.pitch,
          yaw: current.yaw,
        });
        lastDisplayUpdateTime = time;
      }

      // Handle High-DPI canvas buffer sizing only when layout changes
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 320;
      const height = canvas.clientHeight || 250;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Angles to radians
      const phi = ((isDataAvailable ? current.roll : 15) * Math.PI) / 180;
      const theta = ((isDataAvailable ? current.pitch : -20) * Math.PI) / 180;
      const psi = ((isDataAvailable ? current.yaw : 45) * Math.PI) / 180;

      // Project vertices
      const topPoints2D = TOP_POINTS_3D.map((p) =>
        rotateAndProjectPoint(p, phi, theta, psi, cx, cy)
      );
      const bottomPoints2D = BOTTOM_POINTS_3D.map((p) =>
        rotateAndProjectPoint(p, phi, theta, psi, cx, cy)
      );

      const topCenter = rotateAndProjectPoint(
        { x: 0, y: 0, z: CYLINDER_HALF_HEIGHT },
        phi,
        theta,
        psi,
        cx,
        cy
      );
      const bottomCenter = rotateAndProjectPoint(
        { x: 0, y: 0, z: -CYLINDER_HALF_HEIGHT },
        phi,
        theta,
        psi,
        cx,
        cy
      );

      // Draw Background Attitude Ring
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(width, height) * 0.44, 0, Math.PI * 2);
      ctx.stroke();

      // Horizon line tilted by roll
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(phi);
      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(-width * 0.42, 0);
      ctx.lineTo(width * 0.42, 0);
      ctx.stroke();
      ctx.restore();

      // Determine face ordering: draw farther cap first, quads, then nearer cap
      const isTopCapNearer = topCenter.depth < bottomCenter.depth;

      const drawCap = (points: Point2D[], isTop: boolean) => {
        ctx.beginPath();
        points.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        if (isTop) {
          ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1.2;
        } else {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1;
        }
        ctx.fill();
        ctx.stroke();
      };

      if (!isTopCapNearer) {
        drawCap(topPoints2D, true);
      } else {
        drawCap(bottomPoints2D, false);
      }

      // Draw cylindrical hull quads with illumination and solar panel simulation
      // Prepare quad depth list for back-to-front painter's algorithm
      const quads = [];
      for (let i = 0; i < NUM_SLICES; i++) {
        const next = (i + 1) % NUM_SLICES;
        const p1 = topPoints2D[i];
        const p2 = topPoints2D[next];
        const p3 = bottomPoints2D[next];
        const p4 = bottomPoints2D[i];
        const avgDepth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
        quads.push({ i, p1, p2, p3, p4, avgDepth });
      }

      // Sort quads back to front (largest depth first)
      quads.sort((a, b) => b.avgDepth - a.avgDepth);

      for (const quad of quads) {
        const { i, p1, p2, p3, p4, avgDepth } = quad;
        const isSolarPanel = (i >= 2 && i <= 8) || (i >= 14 && i <= 20);
        const intensity = Math.max(0.2, Math.min(1.0, 0.7 - avgDepth / 160));

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();

        if (isSolarPanel) {
          const blueVal = Math.round(180 * intensity + 40);
          ctx.fillStyle = `rgba(14, ${Math.round(80 * intensity)}, ${blueVal}, 0.9)`;
          ctx.strokeStyle = '#0284c7';
        } else {
          const grey = Math.round(200 * intensity + 40);
          ctx.fillStyle = `rgba(${grey}, ${grey + 4}, ${grey + 8}, 0.85)`;
          ctx.strokeStyle = '#94a3b8';
        }
        ctx.lineWidth = 0.8;
        ctx.fill();
        ctx.stroke();
      }

      // Draw nearer cap on top of quads
      if (isTopCapNearer) {
        drawCap(topPoints2D, true);
      } else {
        drawCap(bottomPoints2D, false);
      }

      // Draw Antenna Mast extending from top bulkhead (+Z)
      const antennaBase = topCenter;
      const antennaTip = rotateAndProjectPoint(
        { x: 0, y: 0, z: CYLINDER_HALF_HEIGHT + 35 },
        phi,
        theta,
        psi,
        cx,
        cy
      );

      ctx.beginPath();
      ctx.moveTo(antennaBase.x, antennaBase.y);
      ctx.lineTo(antennaTip.x, antennaTip.y);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Antenna tip indicator node
      ctx.beginPath();
      ctx.arc(antennaTip.x, antennaTip.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      // Draw 3D Gimbal Coordinate Axes from Center of Mass (0, 0, 0)
      const origin = rotateAndProjectPoint({ x: 0, y: 0, z: 0 }, phi, theta, psi, cx, cy);
      const axisLen = 52;

      // +X Axis (Roll / Red): lateral
      const xAxisTip = rotateAndProjectPoint(
        { x: axisLen, y: 0, z: 0 },
        phi,
        theta,
        psi,
        cx,
        cy
      );
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(xAxisTip.x, xAxisTip.y);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('+X (Roll)', xAxisTip.x + 3, xAxisTip.y);

      // +Y Axis (Pitch / Green): transverse
      const yAxisTip = rotateAndProjectPoint(
        { x: 0, y: axisLen, z: 0 },
        phi,
        theta,
        psi,
        cx,
        cy
      );
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(yAxisTip.x, yAxisTip.y);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('+Y (Pitch)', yAxisTip.x + 3, yAxisTip.y);

      // +Z Axis (Yaw / Blue): vertical symmetry axis along cylinder antenna
      const zAxisTip = rotateAndProjectPoint(
        { x: 0, y: 0, z: axisLen },
        phi,
        theta,
        psi,
        cx,
        cy
      );
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(zAxisTip.x, zAxisTip.y);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('+Z (Yaw)', zAxisTip.x + 3, zAxisTip.y);

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isDataAvailable]);

  const displayRoll = isDataAvailable ? displayAngles.roll : 0;
  const displayPitch = isDataAvailable ? displayAngles.pitch : 0;
  const displayYaw = isDataAvailable ? displayAngles.yaw : 0;

  return (
    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            CANSAT ORIENTATION (3D ATTITUDE)
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {isStale && isDataAvailable && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded font-mono">
              STALE
            </span>
          )}
          {zeroOffset.roll !== 0 || zeroOffset.pitch !== 0 || zeroOffset.yaw !== 0 ? (
            <button
              onClick={handleClearOffset}
              title="Reset visual offset to true raw telemetry reference"
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
            >
              ZERO OFFSET ON
            </button>
          ) : null}
          <button
            onClick={handleResetZero}
            disabled={!isDataAvailable}
            title="Set current orientation as visual zero reference (resets viewing offset only, sensor data untouched)"
            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div
        ref={containerRef}
        className="relative w-full h-[250px] min-h-[230px] bg-slate-50/80 rounded border border-slate-200 overflow-hidden flex items-center justify-center"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Status overlay if waiting for telemetry */}
        {!isDataAvailable && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 text-center">
            <RotateCw className="w-6 h-6 text-slate-400 animate-spin mb-1.5" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              ORIENTATION UNAVAILABLE
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Waiting for telemetry roll/pitch/yaw angles (not fabricated)
            </span>
          </div>
        )}

        {/* Convention note in corner */}
        <div className="absolute bottom-1 right-1.5 text-[9px] font-mono text-slate-400 select-none bg-white/70 px-1 rounded">
          Tait-Bryan: R(+X) P(+Y) Y(+Z)
        </div>
      </div>

      {/* Synchronized Live Numeric Readouts */}
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        {/* Roll */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-rose-600 uppercase mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>ROLL</span>
          </div>
          <div className="text-base font-black font-mono text-slate-900">
            {isDataAvailable ? `${displayRoll.toFixed(1)}°` : '--'}
          </div>
        </div>

        {/* Pitch */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-600 uppercase mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>PITCH</span>
          </div>
          <div className="text-base font-black font-mono text-slate-900">
            {isDataAvailable ? `${displayPitch.toFixed(1)}°` : '--'}
          </div>
        </div>

        {/* Yaw */}
        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-sky-600 uppercase mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span>YAW</span>
          </div>
          <div className="text-base font-black font-mono text-slate-900">
            {isDataAvailable ? `${displayYaw.toFixed(1)}°` : '--'}
          </div>
        </div>
      </div>
    </div>
  );
};

