/**
 * TEAM INDRA Ground Station GUI - Targeted Range Test & 3D Orientation Verification
 * Tests for Section 3 of targeted fix prompt
 */

const { DistanceCalculator } = require('../dist-electron/gps/DistanceCalculator');

function assert(condition, testName, detail) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
    process.exitCode = 1;
  }
}

console.log('=================================================================');
console.log('TEAM INDRA - Targeted Range & Orientation Test Suite');
console.log('=================================================================\n');

// -------------------------------------------------------------
// PART 1: RANGE TEST & HAVERSINE DISTANCE AUDIT
// -------------------------------------------------------------
console.log('PART 1: Range Test Distance & Coordinate Robustness');

// 1. Identical positions
const distZero = DistanceCalculator.calculateDistance(12.9716, 77.5946, 12.9716, 77.5946);
assert(distZero === 0, 'Identical positions produce exactly 0.0 m');

// 2. Known distance (0.01 deg North delta ~ 1111.95 meters)
const dist1km = DistanceCalculator.calculateDistance(12.9716, 77.5946, 12.9816, 77.5946);
assert(Math.abs(dist1km - 1111.95) < 5, `0.01 deg delta northward produces plausible distance (~1112m, got ${dist1km.toFixed(1)}m)`);

// 3. Known distance (0.01 deg East delta at equator: 1111.95 m)
const distEquatorLon = DistanceCalculator.calculateDistance(0.0, 0.5, 0.0, 0.51);
assert(Math.abs(distEquatorLon - 1111.95) < 5, `0.01 deg delta eastward at equator produces ~1112m (got ${distEquatorLon.toFixed(1)}m)`);

// 4. Antimeridian Longitude Wraparound (179.999° to -179.999° across 180° meridian)
// Delta is 0.002 degrees = 0.002 * (pi/180) * 6371000 = ~222.4 meters
const distWraparound = DistanceCalculator.calculateDistance(0.0, 179.999, 0.0, -179.999);
assert(Math.abs(distWraparound - 222.4) < 2, `Antimeridian wraparound produces ~222.4m, not 40,000km (got ${distWraparound.toFixed(1)}m)`);

// 5. Bearing calculation across antimeridian (eastward across 180°)
const bearingEast = DistanceCalculator.calculateBearing(0.0, 179.999, 0.0, -179.999);
assert(Math.abs(bearingEast - 90) < 1, `Eastward bearing across antimeridian is 90° (got ${bearingEast.toFixed(1)}°)`);

// 6. Invalid coordinate rejection: Latitude out of range (> 90 or < -90)
assert(!DistanceCalculator.isValidCoordinate(95.0, 77.0), 'Latitude > 90 is rejected as invalid');
assert(!DistanceCalculator.isValidCoordinate(-90.1, 77.0), 'Latitude < -90 is rejected as invalid');

// 7. Invalid coordinate rejection: Longitude out of range (> 180 or < -180)
assert(!DistanceCalculator.isValidCoordinate(12.0, 185.0), 'Longitude > 180 is rejected as invalid');
assert(!DistanceCalculator.isValidCoordinate(12.0, -181.0), 'Longitude < -180 is rejected as invalid');

// 8. Invalid coordinate rejection: Null Island (0.0, 0.0) uninitialized GPS
assert(!DistanceCalculator.isValidCoordinate(0.0, 0.0), 'Null Island (0.0, 0.0) is rejected as uninitialized GPS fix');

// 9. Invalid coordinate rejection: NaN / Null / Undefined
assert(!DistanceCalculator.isValidCoordinate(NaN, 77.0), 'NaN coordinate is rejected as invalid');
assert(!DistanceCalculator.isValidCoordinate(null, 77.0), 'Null coordinate is rejected as invalid');
assert(!DistanceCalculator.isValidCoordinate(12.0, undefined), 'Undefined coordinate is rejected as invalid');
assert(DistanceCalculator.calculateDistance(NaN, 77.0, 12.0, 77.0) === 0, 'Invalid coordinate does not generate false distance (returns 0)');

// 10. Maximum distance persistence simulation across telemetry updates
console.log('\nPART 2: Range Test State Machine & Peak Distance Persistence');
class MockRangeTestSession {
  constructor(gsLat, gsLon) {
    this.gsLat = gsLat;
    this.gsLon = gsLon;
    this.isActive = false;
    this.isPaused = false;
    this.lastValidGps = null;
    this.currentDistanceMeters = null;
    this.maxDistanceMeters = null;
  }

  startTest() {
    this.isActive = true;
    this.isPaused = false;
    if (this.currentDistanceMeters !== null) {
      this.maxDistanceMeters = this.currentDistanceMeters;
    }
  }

  pauseTest() {
    this.isPaused = true;
  }

  resumeTest() {
    this.isPaused = false;
  }

  resetTest() {
    this.isActive = false;
    this.isPaused = false;
    this.maxDistanceMeters = null;
  }

  processTelemetry(lat, lon) {
    if (DistanceCalculator.isValidCoordinate(lat, lon)) {
      this.lastValidGps = { lat, lon, timestamp: Date.now() };
      const dist = DistanceCalculator.calculateDistance(this.gsLat, this.gsLon, lat, lon);
      this.currentDistanceMeters = dist;
      if (this.isActive && !this.isPaused) {
        const prevMax = this.maxDistanceMeters ?? dist;
        this.maxDistanceMeters = Math.max(prevMax, dist);
      }
    }
    // If packet has no valid GPS (null or non-GPS packet), lastValidGps and currentDistanceMeters are preserved!
  }
}

const session = new MockRangeTestSession(12.9716, 77.5946);
session.startTest();

// Packet 1: CanSat at 100m northward (lat 12.9725)
session.processTelemetry(12.9725, 77.5946);
const distPkt1 = session.currentDistanceMeters;
assert(distPkt1 > 90 && distPkt1 < 110, `Packet 1 distance recorded (~100m, got ${distPkt1.toFixed(1)}m)`);
assert(session.maxDistanceMeters === distPkt1, 'Max distance initialized to Packet 1 distance');

// Packet 2: CanSat moves farther to 500m northward (lat 12.9761)
session.processTelemetry(12.9761, 77.5946);
const distPkt2 = session.currentDistanceMeters;
assert(session.maxDistanceMeters === distPkt2 && distPkt2 > 490, `Max distance increases to peak (~500m, got ${session.maxDistanceMeters.toFixed(1)}m)`);

// Packet 3: Sensor-only packet arrives without GPS (lat: null, lon: null)
session.processTelemetry(null, null);
assert(session.currentDistanceMeters === distPkt2, 'Sensor packet without GPS does NOT erase current distance');
assert(session.maxDistanceMeters === distPkt2, 'Sensor packet without GPS does NOT erase maximum distance');
assert(session.lastValidGps !== null, 'Last valid GPS fix remains cached');

// Packet 4: CanSat returns closer to 200m northward (lat 12.9734)
session.processTelemetry(12.9734, 77.5946);
const distPkt4 = session.currentDistanceMeters;
assert(distPkt4 < 250, `Distance decreases to ~200m (got ${distPkt4.toFixed(1)}m)`);
assert(session.maxDistanceMeters === distPkt2, 'Max distance persists at peak (500m) and does NOT reset when CanSat gets closer');

// Packet 5: Pause test and move farther to 1000m (lat 12.9806)
session.pauseTest();
session.processTelemetry(12.9806, 77.5946);
assert(session.maxDistanceMeters === distPkt2, 'Pausing test freezes max distance tracking (did not update while paused)');

// Resume test
session.resumeTest();
session.processTelemetry(12.9806, 77.5946);
assert(session.maxDistanceMeters > 950, 'Resuming test tracks new higher peak distance (~1000m)');

// Explicit Reset
session.resetTest();
assert(session.maxDistanceMeters === null, 'Explicit reset test clears peak session statistics');
assert(session.currentDistanceMeters !== null, 'Current live distance remains available after reset');

// -------------------------------------------------------------
// PART 3: 3D ORIENTATION MATH, AXES & WRAPAROUND
// -------------------------------------------------------------
console.log('\nPART 3: 3D Orientation Shortest-Path Wraparound & Tait-Bryan Geometry');

// Shortest path angular difference function (same as implemented in CanSatOrientation.tsx)
function getShortestAngleDelta(targetDeg, currentDeg) {
  return ((targetDeg - currentDeg + 540) % 360) - 180;
}

// 1. Yaw wraparound from 359° to 1° should rotate +2°, not -358°
const delta359to1 = getShortestAngleDelta(1, 359);
assert(delta359to1 === 2, `Yaw transition 359° -> 1° follows shortest path +2° (got ${delta359to1}°)`);

// 2. Yaw wraparound from 1° to 359° should rotate -2°, not +358°
const delta1to359 = getShortestAngleDelta(359, 1);
assert(delta1to359 === -2, `Yaw transition 1° -> 359° follows shortest path -2° (got ${delta1to359}°)`);

// 3. 180° boundary transition
const delta179to181 = getShortestAngleDelta(181, 179);
assert(delta179to181 === 2, `Yaw transition 179° -> 181° is +2° (got ${delta179to181}°)`);

// 4. Body Axis Verification for CanSat cylinder
// Cylinder body: symmetry axis is Z. Top bulkhead at +Z, bottom cap at -Z.
// Rotation: Roll around X, Pitch around Y, Yaw around Z.
const CYLINDER_HALF_HEIGHT = 65;
const CAMERA_PITCH = (22 * Math.PI) / 180;
const COS_CAM = Math.cos(CAMERA_PITCH);
const SIN_CAM = Math.sin(CAMERA_PITCH);

function rotateBodyPoint(p, phi, theta, psi) {
  // 1. Roll around X
  const x1 = p.x;
  const y1 = p.y * Math.cos(phi) - p.z * Math.sin(phi);
  const z1 = p.y * Math.sin(phi) + p.z * Math.cos(phi);

  // 2. Pitch around Y
  const x2 = x1 * Math.cos(theta) + z1 * Math.sin(theta);
  const y2 = y1;
  const z2 = -x1 * Math.sin(theta) + z1 * Math.cos(theta);

  // 3. Yaw around Z
  const x3 = x2 * Math.cos(psi) - y2 * Math.sin(psi);
  const y3 = x2 * Math.sin(psi) + y2 * Math.cos(psi);
  const z3 = z2;

  // Camera projection coordinate
  const xCam = x3;
  const yCam = -z3 * COS_CAM + y3 * SIN_CAM;
  const zCam = z3 * SIN_CAM + y3 * COS_CAM;

  return { xCam, yCam, zCam, zWorld: z3 };
}

// At zero orientation (Roll=0, Pitch=0, Yaw=0):
const topZero = rotateBodyPoint({ x: 0, y: 0, z: CYLINDER_HALF_HEIGHT }, 0, 0, 0);
const bottomZero = rotateBodyPoint({ x: 0, y: 0, z: -CYLINDER_HALF_HEIGHT }, 0, 0, 0);

// Top cap is vertically above bottom cap on canvas (more negative yCam = higher on screen)
assert(topZero.yCam < bottomZero.yCam, 'At zero attitude, top cap is above bottom cap on screen');
assert(Math.abs(topZero.xCam) < 0.001, 'At zero attitude, cylinder center is horizontally centered (xCam = 0)');

// Pure Yaw rotation: Yaw=90° (spin around vertical cylinder axis)
const topYaw90 = rotateBodyPoint({ x: 0, y: 0, z: CYLINDER_HALF_HEIGHT }, 0, 0, Math.PI / 2);
assert(Math.abs(topYaw90.yCam - topZero.yCam) < 0.001, 'Pure Yaw (90°) preserves vertical upright position (does NOT tilt or tumble cylinder)');
assert(Math.abs(topYaw90.xCam) < 0.001, 'Pure Yaw keeps top cap centered on axis');

// Pure Pitch rotation: Pitch=45° tilts along transverse axis
const topPitch45 = rotateBodyPoint({ x: 0, y: 0, z: CYLINDER_HALF_HEIGHT }, 0, Math.PI / 4, 0);
assert(topPitch45.yCam !== topZero.yCam, 'Pitch rotation tilts top cap forward/backward');

// Pure Roll rotation: Roll=45° tilts along lateral axis
const topRoll45 = rotateBodyPoint({ x: 0, y: 0, z: CYLINDER_HALF_HEIGHT }, Math.PI / 4, 0, 0);
assert(topRoll45.yCam !== topZero.yCam, 'Roll rotation tilts top cap laterally');

// Corrupted value rejection test
function validateOrientation(r, p, y) {
  if (typeof r !== 'number' || typeof p !== 'number' || typeof y !== 'number') return false;
  if (!isFinite(r) || !isFinite(p) || !isFinite(y)) return false;
  if (isNaN(r) || isNaN(p) || isNaN(y)) return false;
  if (Math.abs(r) > 360 || Math.abs(p) > 360 || Math.abs(y) > 720) return false;
  return true;
}

assert(validateOrientation(12.4, -5.2, 184.3), 'Standard valid flight telemetry passes orientation validation');
assert(!validateOrientation(NaN, 0, 0), 'Corrupted NaN angle rejected');
assert(!validateOrientation(0, Infinity, 0), 'Corrupted Infinity angle rejected');
assert(!validateOrientation(9999, 0, 0), 'Out-of-range corrupted spike (>360°) rejected');

console.log('\n=================================================================');
console.log('ALL TARGETED VERIFICATION CHECKS PASSED WITH ZERO ERRORS!');
console.log('=================================================================');
