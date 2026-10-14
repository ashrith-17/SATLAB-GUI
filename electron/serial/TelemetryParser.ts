import { FlightState, TelemetryData } from '../types/telemetry';

export class TelemetryParser {
  private fallbackPacketCount = 0;
  private blockBuffer: string[] = [];
  private isBufferingBlock = false;

  /**
   * Main entry point to parse a raw string line into TelemetryData.
   * Supports both single-line telemetry and multi-line block frames from CanSat hardware.
   * Returns null if line is empty, in-progress block fragment, or purely unparseable text.
   */
  public parseLine(rawLine: string): TelemetryData | null {
    const trimmed = rawLine.trim();
    if (!trimmed) return null;

    // Check for multi-line block packet header
    if (trimmed.includes('CANSAT TELEMETRY') || (trimmed.startsWith('==========') && !this.isBufferingBlock)) {
      this.isBufferingBlock = true;
      this.blockBuffer = [trimmed];
      return null;
    }

    // Accumulate lines if currently buffering a multi-line block
    if (this.isBufferingBlock) {
      this.blockBuffer.push(trimmed);

      // Check for multi-line block footer
      if (trimmed.startsWith('==========') && this.blockBuffer.length > 5) {
        this.isBufferingBlock = false;
        const completeBlock = [...this.blockBuffer];
        this.blockBuffer = [];
        return this.parseMultiLineBlock(completeBlock);
      }

      // Safeguard against unbounded buffering
      if (this.blockBuffer.length > 100) {
        this.isBufferingBlock = false;
        this.blockBuffer = [];
      }
      return null;
    }

    // Check if line contains Key-Value pairs like "PKT:42 | TIME:00:01:32 | TEMP:23.45..."
    if (trimmed.includes(':') || trimmed.includes('=')) {
      return this.parseKeyValuePacket(trimmed);
    }

    // Check if line is CSV separated by commas or semicolons
    if (trimmed.includes(',') || trimmed.includes(';')) {
      return this.parseCsvPacket(trimmed);
    }

    return null;
  }

  /**
   * Parses multi-line structured block telemetry frames transmitted by physical CanSat
   */
  private parseMultiLineBlock(lines: string[]): TelemetryData | null {
    try {
      let section = '';
      const data: Record<string, string> = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-----') && trimmed.endsWith('-----')) {
          section = trimmed.replace(/-/g, '').trim().toUpperCase();
          continue;
        }
        if (trimmed.includes(':')) {
          const idx = trimmed.indexOf(':');
          const key = (section ? section + '_' : '') + trimmed.slice(0, idx).trim().toUpperCase();
          const rawVal = trimmed.slice(idx + 1).trim();
          data[key] = rawVal;
        }
      }

      this.fallbackPacketCount++;
      const packetNumber = this.fallbackPacketCount;

      // Millis to formatted timestamp
      const rawMillis = data['TELEMETRY STATUS_MILLIS'];
      let timestamp = this.getFormattedTime();
      if (rawMillis) {
        const totalSec = Math.floor(parseInt(rawMillis, 10) / 1000);
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        const p = (n: number) => String(n).padStart(2, '0');
        timestamp = `${p(hrs)}:${p(mins)}:${p(secs)}`;
      }

      // Temperatures
      const bmeTemp = parseFloat(data['BME280_TEMPERATURE']) || null;
      const dpsTemp = parseFloat(data['DPS310_TEMPERATURE']) || null;
      const temperature = dpsTemp !== null && !isNaN(dpsTemp) ? dpsTemp : (bmeTemp !== null && !isNaN(bmeTemp) ? bmeTemp : 0);

      // Pressures
      const bmePress = parseFloat(data['BME280_PRESSURE']) || null;
      const dpsPress = parseFloat(data['DPS310_PRESSURE']) || null;
      let pressure = dpsPress !== null && !isNaN(dpsPress) ? dpsPress : (bmePress !== null && !isNaN(bmePress) ? bmePress : 1013.25);
      if (pressure > 2000) pressure = parseFloat((pressure / 100).toFixed(2));

      // Humidity
      const rawHum = data['BME280_HUMIDITY'];
      const humidity = rawHum ? parseFloat(rawHum) : null;

      // IMU Acceleration
      const ax = parseFloat(data['BNO086_ACCEL X']) || 0;
      const ay = parseFloat(data['BNO086_ACCEL Y']) || 0;
      const az = parseFloat(data['BNO086_ACCEL Z']) || 9.81;

      // Gyroscope
      const gx = parseFloat(data['BNO086_GYRO X']) || 0;
      const gy = parseFloat(data['BNO086_GYRO Y']) || 0;
      const gz = parseFloat(data['BNO086_GYRO Z']) || 0;

      // Quaternions & Euler Angles
      const qI = parseFloat(data['BNO086_QUAT I']);
      const qJ = parseFloat(data['BNO086_QUAT J']);
      const qK = parseFloat(data['BNO086_QUAT K']);
      const qReal = parseFloat(data['BNO086_QUAT REAL']);

      let roll = 0;
      let pitch = 0;
      let yaw = 0;
      if (!isNaN(qI) && !isNaN(qJ) && !isNaN(qK) && !isNaN(qReal)) {
        roll = parseFloat((Math.atan2(2 * (qReal * qI + qJ * qK), 1 - 2 * (qI * qI + qJ * qJ)) * (180 / Math.PI)).toFixed(2));
        const sinP = Math.max(-1, Math.min(1, 2 * (qReal * qJ - qK * qI)));
        pitch = parseFloat((Math.asin(sinP) * (180 / Math.PI)).toFixed(2));
        yaw = parseFloat(((Math.atan2(2 * (qReal * qK + qI * qJ), 1 - 2 * (qJ * qJ + qK * qK)) * (180 / Math.PI) + 360) % 360).toFixed(2));
      }

      // GNSS Navigation
      const rawLat = data['L89HA GNSS_LATITUDE'];
      const latitude = rawLat && !rawLat.toUpperCase().includes('INVALID') ? parseFloat(rawLat) : null;

      const rawLon = data['L89HA GNSS_LONGITUDE'];
      const longitude = rawLon && !rawLon.toUpperCase().includes('INVALID') ? parseFloat(rawLon) : null;

      const rawGpsAlt = data['L89HA GNSS_ALTITUDE'];
      const gpsAltitude = rawGpsAlt && !rawGpsAlt.toUpperCase().includes('INVALID') ? parseFloat(rawGpsAlt) : null;

      const rawGpsSpeed = data['L89HA GNSS_SPEED'];
      const gpsSpeed = rawGpsSpeed && !rawGpsSpeed.toUpperCase().includes('INVALID') ? parseFloat(rawGpsSpeed) : null;

      const rawSats = data['L89HA GNSS_SATELLITES'];
      const gpsSats = rawSats && !rawSats.toUpperCase().includes('INVALID') ? parseInt(rawSats, 10) : null;

      // Barometric Altitude estimation from DPS310 pressure
      let altitude = gpsAltitude !== null ? gpsAltitude : 0;
      if (pressure > 0) {
        altitude = parseFloat((44330 * (1 - Math.pow(pressure / 1013.25, 0.1903))).toFixed(2));
      }

      // Signal Link
      const rawRssi = data['TELEMETRY STATUS_RSSI'];
      const rssi = rawRssi ? parseInt(rawRssi, 10) : null;

      // Flight State
      const flightState = this.determineFlightState(undefined, altitude);

      return {
        packetNumber,
        timestamp,
        timestampMs: Date.now(),
        altitude,
        temperature,
        humidity: humidity !== null && !isNaN(humidity) ? humidity : null,
        pressure,
        battery: 98.5,
        roll,
        pitch,
        yaw,
        gx,
        gy,
        gz,
        ax,
        ay,
        az,
        latitude: latitude !== null && !isNaN(latitude) ? latitude : null,
        longitude: longitude !== null && !isNaN(longitude) ? longitude : null,
        gpsAltitude: gpsAltitude !== null && !isNaN(gpsAltitude) ? gpsAltitude : null,
        gpsSats: gpsSats !== null && !isNaN(gpsSats) ? gpsSats : null,
        gpsSpeed: gpsSpeed !== null && !isNaN(gpsSpeed) ? gpsSpeed : null,
        rssi: rssi !== null && !isNaN(rssi) ? rssi : null,
        flightState,
        rawPacket: lines.join(' | '),
      };
    } catch (err) {
      console.error('Error parsing multi-line block packet:', err);
      return null;
    }
  }

  /**
   * Parses key-value formatted telemetry packet
   * Example: PKT:42 | TIME:00:01:32 | TEMP:23.45 C | PRESS:1013.25 hPa | ALT:120.50 m | R:1.20 deg | P:-0.50 deg | H:88.30 deg | GX:0.012 | GY:-0.003 | GZ:0.001 | AX:0.050 | AY:-0.020 | AZ:9.780 | STATE:ASCENT | LAT:12.9716 | LON:77.5946 | BATT:87
   */
  private parseKeyValuePacket(rawLine: string): TelemetryData | null {
    try {
      const map = new Map<string, string>();
      const delimiters = [/\s*\|\s*/, /\s*,\s*/, /\s*;\s*/];
      let tokens: string[] = [rawLine];

      for (const delim of delimiters) {
        if (rawLine.match(delim)) {
          tokens = rawLine.split(delim);
          break;
        }
      }

      for (const token of tokens) {
        let key = '';
        let val = '';
        if (token.includes(':')) {
          const parts = token.split(':');
          key = parts[0].trim().toUpperCase();
          val = parts.slice(1).join(':').trim();
        } else if (token.includes('=')) {
          const parts = token.split('=');
          key = parts[0].trim().toUpperCase();
          val = parts.slice(1).join('=').trim();
        }

        if (key && val) {
          // Remove unit descriptors like "C", "hPa", "Pa", "m", "deg", "%RH", "%", "m/s", "km/h", "V", "g"
          val = val.replace(/(%RH|%|C|hPa|Pa|m\/s|km\/h|m|deg|rad\/s|V|g)$/i, '').trim();
          map.set(key, val);
        }
      }

      // If we didn't find at least 2 key telemetry keys, reject
      const hasCoreKey = ['PKT', 'ALT', 'TEMP', 'HUM', 'PRESS', 'R', 'P', 'H', 'AX', 'AZ'].some((k) =>
        map.has(k)
      );

      if (!hasCoreKey) {
        return null;
      }

      this.fallbackPacketCount++;
      const packetNumber = this.parseFloatOrDefault(map.get('PKT'), this.fallbackPacketCount);
      const timestamp = map.get('TIME') || this.getFormattedTime();

      const altitude = this.parseFloatOrDefault(map.get('ALT') || map.get('ALTITUDE'), 0);
      const temperature = this.parseFloatOrDefault(map.get('TEMP') || map.get('TEMPERATURE'), 0);

      // BME280 Relative Humidity (% RH)
      const rawHum = map.get('HUM') || map.get('HUMIDITY') || map.get('RH');
      const humidity = rawHum !== undefined ? this.parseFloatOrDefault(rawHum, 0) : null;

      // DPS310 Atmospheric Pressure (ensure hPa)
      let pressure = this.parseFloatOrDefault(map.get('PRESS') || map.get('PRESSURE'), 1013.25);
      // If pressure was transmitted in Pa (> 2000 Pa, typically ~101325 Pa), convert to hPa
      if (pressure > 2000) {
        pressure = parseFloat((pressure / 100).toFixed(2));
      }

      const battery = this.parseFloatOrDefault(map.get('BATT') || map.get('BATTERY'), 100);

      const roll = this.parseFloatOrDefault(map.get('R') || map.get('ROLL'), 0);
      const pitch = this.parseFloatOrDefault(map.get('P') || map.get('PITCH'), 0);
      const yaw = this.parseFloatOrDefault(map.get('H') || map.get('YAW') || map.get('HEADING'), 0);

      const gx = this.parseFloatOrDefault(map.get('GX'), 0);
      const gy = this.parseFloatOrDefault(map.get('GY'), 0);
      const gz = this.parseFloatOrDefault(map.get('GZ'), 0);

      const ax = this.parseFloatOrDefault(map.get('AX'), 0);
      const ay = this.parseFloatOrDefault(map.get('AY'), 0);
      const az = this.parseFloatOrDefault(map.get('AZ'), 9.81);

      const latitude = map.has('LAT') ? parseFloat(map.get('LAT')!) : null;
      const longitude = map.has('LON') || map.has('LNG') ? parseFloat(map.get('LON') || map.get('LNG')!) : null;
      const gpsAltitude = map.has('GPS_ALT') ? parseFloat(map.get('GPS_ALT')!) : null;
      const gpsSats = map.has('SATS') ? parseInt(map.get('SATS')!, 10) : null;
      const rawSpeed = map.get('SPD') || map.get('SPEED') || map.get('GPS_SPD');
      const gpsSpeed = rawSpeed !== undefined ? parseFloat(rawSpeed) : null;
      const rssi = map.has('RSSI') ? parseInt(map.get('RSSI')!, 10) : null;

      const flightState = this.determineFlightState(map.get('STATE') || map.get('FLIGHT_STATE'), altitude);

      return {
        packetNumber,
        timestamp,
        timestampMs: Date.now(),
        altitude,
        temperature,
        humidity: humidity !== null && !isNaN(humidity) ? humidity : null,
        pressure,
        battery,
        roll,
        pitch,
        yaw,
        gx,
        gy,
        gz,
        ax,
        ay,
        az,
        latitude: isNaN(latitude!) ? null : latitude,
        longitude: isNaN(longitude!) ? null : longitude,
        gpsAltitude: isNaN(gpsAltitude!) ? null : gpsAltitude,
        gpsSats: isNaN(gpsSats!) ? null : gpsSats,
        gpsSpeed: isNaN(gpsSpeed!) ? null : gpsSpeed,
        rssi: isNaN(rssi!) ? null : rssi,
        flightState,
        rawPacket: rawLine,
      };
    } catch (err) {
      console.error('Error parsing key-value packet:', err);
      return null;
    }
  }

  /**
   * Parses CSV formatted telemetry lines
   */
  private parseCsvPacket(rawLine: string): TelemetryData | null {
    try {
      const parts = rawLine.split(/[,;]/).map((p) => p.trim());
      if (parts.length < 5) return null;

      this.fallbackPacketCount++;
      let idx = 0;
      const packetNumber = parseFloat(parts[idx++]) || this.fallbackPacketCount;
      const timestamp = parts[idx++] || this.getFormattedTime();
      const altitude = parseFloat(parts[idx++]) || 0;
      const temperature = parseFloat(parts[idx++]) || 0;
      const pressure = parseFloat(parts[idx++]) || 1013.25;
      const battery = parseFloat(parts[idx++]) || 100;

      const roll = parseFloat(parts[idx++]) || 0;
      const pitch = parseFloat(parts[idx++]) || 0;
      const yaw = parseFloat(parts[idx++]) || 0;

      const gx = parseFloat(parts[idx++]) || 0;
      const gy = parseFloat(parts[idx++]) || 0;
      const gz = parseFloat(parts[idx++]) || 0;

      const ax = parseFloat(parts[idx++]) || 0;
      const ay = parseFloat(parts[idx++]) || 0;
      const az = parseFloat(parts[idx++]) || 9.81;

      const latitude = idx < parts.length ? parseFloat(parts[idx++]) : null;
      const longitude = idx < parts.length ? parseFloat(parts[idx++]) : null;
      const gpsAltitude = idx < parts.length ? parseFloat(parts[idx++]) : null;
      const gpsSats = idx < parts.length ? parseInt(parts[idx++], 10) : null;
      const rssi = idx < parts.length ? parseInt(parts[idx++], 10) : null;
      const rawState = idx < parts.length ? parts[idx++] : undefined;

      const flightState = this.determineFlightState(rawState, altitude);

      // Ensure pressure in hPa
      let finalPressure = pressure;
      if (finalPressure > 2000) {
        finalPressure = parseFloat((finalPressure / 100).toFixed(2));
      }

      return {
        packetNumber,
        timestamp,
        timestampMs: Date.now(),
        altitude,
        temperature,
        humidity: null, // CSV legacy format does not contain humidity column
        pressure: finalPressure,
        battery,
        roll,
        pitch,
        yaw,
        gx,
        gy,
        gz,
        ax,
        ay,
        az,
        latitude: isNaN(latitude!) ? null : latitude,
        longitude: isNaN(longitude!) ? null : longitude,
        gpsAltitude: isNaN(gpsAltitude!) ? null : gpsAltitude,
        gpsSats: isNaN(gpsSats!) ? null : gpsSats,
        gpsSpeed: null,
        rssi: isNaN(rssi!) ? null : rssi,
        flightState,
        rawPacket: rawLine,
      };
    } catch (err) {
      console.error('Error parsing CSV packet:', err);
      return null;
    }
  }

  private parseFloatOrDefault(val: string | undefined, defaultVal: number): number {
    if (!val) return defaultVal;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? defaultVal : parsed;
  }

  private determineFlightState(rawState: string | undefined, altitude: number): FlightState {
    if (rawState) {
      const s = rawState.toUpperCase();
      if (s.includes('PRE') || s.includes('LAUNCH')) return 'PRE-LAUNCH';
      if (s.includes('ASC')) return 'ASCENT';
      if (s.includes('DESC')) return 'DESCENT';
      if (s.includes('LAND')) return 'LANDED';
    }

    // Default status strictly for visualization state fallback if not explicitly provided
    if (altitude < 5) return 'PRE-LAUNCH';
    return 'ASCENT';
  }

  private getFormattedTime(): string {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
  }
}
