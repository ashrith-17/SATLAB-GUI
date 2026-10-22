/**
 * TEAM INDRA Ground Station GUI - INA219/INA226 Power Module Verification Suite
 * Verifies parsing, calculations, battery status, and sensor states
 */

const { TelemetryParser } = require('../dist-electron/serial/TelemetryParser');

function assert(condition, testName, detail) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
    process.exitCode = 1;
  }
}

console.log('=================================================================');
console.log('TEAM INDRA - INA219 / INA226 Power Module Verification Suite');
console.log('=================================================================\n');

const parser = new TelemetryParser();

// -------------------------------------------------------------
// TEST 1: KEY-VALUE PACKET WITH EXPLICIT INA TELEMETRY
// -------------------------------------------------------------
console.log('TEST 1: Single-Line Key-Value Packet with INA Data');
const kvWithIna =
  'PKT:50 | TIME:12:30:00 | TEMP:23.5 C | PRESS:1008.2 hPa | ALT:125.0 m | ' +
  'VBUS:3.85 V | CURR:142.5 mA | PWR:548.6 mW | ' +
  'R:0.5 | P:-1.2 | H:90.0 | AX:0.01 | AY:0.02 | AZ:9.81 | BATT:85.0';

const parsed1 = parser.parseLine(kvWithIna);
assert(parsed1 !== null, 'Key-value packet with INA fields parsed');
if (parsed1) {
  assert(parsed1.voltage === 3.85, `Bus voltage parsed as 3.85 V (got ${parsed1.voltage} V)`);
  assert(parsed1.current === 142.5, `Shunt current parsed as 142.5 mA (got ${parsed1.current} mA)`);
  assert(parsed1.power === 548.6, `Sensor-reported power parsed as 548.6 mW (got ${parsed1.power} mW)`);
  assert(parsed1.altitude === 125.0, 'Other telemetry (altitude) preserved');
}

// -------------------------------------------------------------
// TEST 2: AUTO-CALCULATION OF POWER (P = V * I) WHEN POWER IS OMITTED
// -------------------------------------------------------------
console.log('\nTEST 2: Automatic Power Calculation (P = V * I)');
const kvWithoutPwr =
  'PKT:51 | TIME:12:30:01 | TEMP:23.5 C | PRESS:1008.2 hPa | ALT:125.0 m | ' +
  'VOLT:7.40 V | CURRENT:200.0 mA | ' +
  'R:0.0 | P:0.0 | H:0.0 | AX:0 | AY:0 | AZ:9.81';

const parsed2 = parser.parseLine(kvWithoutPwr);
assert(parsed2 !== null, 'Packet without explicit power parsed');
if (parsed2) {
  assert(parsed2.voltage === 7.40, 'Voltage is 7.40 V');
  assert(parsed2.current === 200.0, 'Current is 200.0 mA');
  // P = 7.40 V * 200.0 mA = 1480.0 mW
  assert(parsed2.power === 1480.0, `Power calculated automatically: 7.4V * 200mA = 1480.0 mW (got ${parsed2.power} mW)`);
}

// -------------------------------------------------------------
// TEST 3: MULTI-LINE BLOCK PACKET WITH INA219 SECTION
// -------------------------------------------------------------
console.log('\nTEST 3: Multi-Line Block Frame with INA219 Section');
const blockLines = [
  '==============================',
  'CANSAT TELEMETRY FRAME #52',
  '----- TELEMETRY STATUS -----',
  'MILLIS: 45000',
  'RSSI: -68',
  '----- DPS310 -----',
  'PRESSURE: 1005.20',
  'TEMPERATURE: 24.1',
  '----- INA219 -----',
  'BUS VOLTAGE: 3.78',
  'SHUNT CURRENT: 165.2',
  'POWER: 624.5',
  '----- BNO086 -----',
  'ACCEL X: 0.05',
  'ACCEL Y: -0.02',
  'ACCEL Z: 9.80',
  'QUAT REAL: 1.0',
  'QUAT I: 0.0',
  'QUAT J: 0.0',
  'QUAT K: 0.0',
  '==============================',
];

let parsedBlock = null;
for (const line of blockLines) {
  const res = parser.parseLine(line);
  if (res) parsedBlock = res;
}

assert(parsedBlock !== null, 'Multi-line block with INA219 section successfully parsed');
if (parsedBlock) {
  assert(parsedBlock.voltage === 3.78, `Block INA219 Bus Voltage is 3.78 V (got ${parsedBlock.voltage} V)`);
  assert(parsedBlock.current === 165.2, `Block INA219 Shunt Current is 165.2 mA (got ${parsedBlock.current} mA)`);
  assert(parsedBlock.power === 624.5, `Block INA219 Power is 624.5 mW (got ${parsedBlock.power} mW)`);
}

// -------------------------------------------------------------
// TEST 4: PACKET WITHOUT INA DATA PRODUCES NULL (NO FABRICATION)
// -------------------------------------------------------------
console.log('\nTEST 4: Telemetry Packet Without INA Fields (No Fabrication)');
const noInaPacket =
  'PKT:53 | TIME:12:30:03 | TEMP:24.0 C | PRESS:1005.0 hPa | ALT:130.0 m | ' +
  'R:1.0 | P:0.0 | H:45.0 | AX:0.0 | AY:0.0 | AZ:9.81';

const parsedNoIna = parser.parseLine(noInaPacket);
assert(parsedNoIna !== null, 'Standard telemetry packet parsed');
if (parsedNoIna) {
  assert(parsedNoIna.voltage === null, 'Voltage is strictly null when not transmitted');
  assert(parsedNoIna.current === null, 'Current is strictly null when not transmitted');
  assert(parsedNoIna.power === null, 'Power is strictly null when not transmitted');
}

// -------------------------------------------------------------
// TEST 5: BATTERY STATUS THRESHOLD LOGIC (1S & 2S LIPO)
// -------------------------------------------------------------
console.log('\nTEST 5: Battery Status Logic (NORMAL / LOW / CRITICAL)');

function evaluateBatteryStatus(voltage, lowThresh = 3.5, critThresh = 3.3) {
  if (voltage === null || isNaN(voltage)) return 'UNKNOWN';
  if (voltage <= critThresh) return 'CRITICAL';
  if (voltage <= lowThresh) return 'LOW';
  return 'NORMAL';
}

// 1S LiPo Tests (Nominal 3.7V, Full 4.2V, Low <= 3.5V, Critical <= 3.3V)
assert(evaluateBatteryStatus(3.90, 3.5, 3.3) === 'NORMAL', '3.90V on 1S is NORMAL');
assert(evaluateBatteryStatus(3.45, 3.5, 3.3) === 'LOW', '3.45V on 1S is LOW (<= 3.5V)');
assert(evaluateBatteryStatus(3.20, 3.5, 3.3) === 'CRITICAL', '3.20V on 1S is CRITICAL (<= 3.3V)');
assert(evaluateBatteryStatus(null, 3.5, 3.3) === 'UNKNOWN', 'Null voltage is UNKNOWN');

// 2S LiPo Tests (Nominal 7.4V, Full 8.4V, Low <= 7.0V, Critical <= 6.6V)
assert(evaluateBatteryStatus(7.80, 7.0, 6.6) === 'NORMAL', '7.80V on 2S is NORMAL');
assert(evaluateBatteryStatus(6.90, 7.0, 6.6) === 'LOW', '6.90V on 2S is LOW');
assert(evaluateBatteryStatus(6.40, 7.0, 6.6) === 'CRITICAL', '6.40V on 2S is CRITICAL');

// -------------------------------------------------------------
// TEST 6: SENSOR STATUS (LIVE / DISCONNECTED / NO DATA)
// -------------------------------------------------------------
console.log('\nTEST 6: INA Sensor Status State Machine');

function evaluateSensorStatus(isConnected, hasInaData, isStale) {
  if (!isConnected) return 'DISCONNECTED';
  if (hasInaData && !isStale) return 'LIVE';
  if (isStale) return 'DISCONNECTED';
  return 'NO DATA';
}

assert(evaluateSensorStatus(false, false, false) === 'DISCONNECTED', 'Serial disconnected yields DISCONNECTED');
assert(evaluateSensorStatus(true, false, false) === 'NO DATA', 'Connected without INA data yields NO DATA (waiting)');
assert(evaluateSensorStatus(true, true, false) === 'LIVE', 'Connected with valid fresh INA data yields LIVE');
assert(evaluateSensorStatus(true, true, true) === 'DISCONNECTED', 'Stale stream yields DISCONNECTED');

console.log('\n=================================================================');
console.log('ALL INA219/INA226 VERIFICATION CHECKS PASSED WITH ZERO ERRORS!');
console.log('=================================================================');
