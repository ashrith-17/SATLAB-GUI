import { EventEmitter } from 'events';
import { CommandItem, CommandLog } from '../types/telemetry';
import { TelemetryLogger } from '../logging/TelemetryLogger';

export class CommandManager extends EventEmitter {
  private logger: TelemetryLogger;
  private pendingCommands: Map<string, { log: CommandLog; timer: NodeJS.Timeout }> = new Map();
  private ackTimeoutMs: number = 3000;

  // Default predefined flight commands
  private predefinedCommands: CommandItem[] = [
    { id: 'CMD_PING', name: 'PING', payload: 'CMD:PING', isCritical: false, description: 'Check ground-station link' },
    { id: 'CMD_STATUS', name: 'REQUEST STATUS', payload: 'CMD:STATUS', isCritical: false, description: 'Request CanSat health report' },
    { id: 'CMD_BUZZER_ON', name: 'BUZZER ON', payload: 'CMD:BUZZER_ON', isCritical: false, description: 'Activate location audio beacon' },
    { id: 'CMD_BUZZER_OFF', name: 'BUZZER OFF', payload: 'CMD:BUZZER_OFF', isCritical: false, description: 'Deactivate audio beacon' },
    { id: 'CMD_DEPLOY', name: 'DEPLOY PARACHUTE', payload: 'CMD:DEPLOY_PARACHUTE', isCritical: true, description: 'Manual ejection of recovery chute' },
    { id: 'CMD_ABORT', name: 'ABORT', payload: 'CMD:ABORT', isCritical: true, description: 'Immediate emergency abort sequence' },
    { id: 'CMD_RESET', name: 'RESET', payload: 'CMD:RESET', isCritical: false, description: 'Reboot flight software controller' },
  ];

  constructor(logger: TelemetryLogger) {
    super();
    this.logger = logger;
  }

  public getPredefinedCommands(): CommandItem[] {
    return this.predefinedCommands;
  }

  public registerCommandLog(cmdItem: CommandItem): CommandLog {
    const logId = `CMD_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const log: CommandLog = {
      id: logId,
      timestamp: new Date().toLocaleTimeString(),
      commandName: cmdItem.name,
      payload: cmdItem.payload,
      status: 'SENT',
    };

    // Set timeout for ACK check
    const timer = setTimeout(() => {
      this.handleTimeout(logId);
    }, this.ackTimeoutMs);

    this.pendingCommands.set(logId, { log, timer });
    this.logger.logCommand(cmdItem.name, cmdItem.payload, 'SENT');
    return log;
  }

  public handleIncomingPacket(rawPacket: string): void {
    if (!rawPacket.includes('ACK')) return;

    // Check if raw packet matches any pending command
    for (const [logId, item] of this.pendingCommands.entries()) {
      if (rawPacket.includes(item.log.payload) || rawPacket.includes(item.log.commandName)) {
        clearTimeout(item.timer);
        item.log.status = 'ACKNOWLEDGED';
        item.log.response = rawPacket;
        this.logger.logCommand(item.log.commandName, item.log.payload, 'ACKNOWLEDGED', rawPacket);
        this.emit('command-ack', item.log);
        this.pendingCommands.delete(logId);
        break;
      }
    }
  }

  private handleTimeout(logId: string): void {
    const item = this.pendingCommands.get(logId);
    if (item) {
      item.log.status = 'TIMEOUT';
      this.logger.logCommand(item.log.commandName, item.log.payload, 'TIMEOUT');
      this.emit('command-timeout', item.log);
      this.pendingCommands.delete(logId);
    }
  }
}
