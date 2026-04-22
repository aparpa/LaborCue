import type {
  BLEAdvertisementData,
  BLECharacteristic,
  BLEService,
  BluetoothState,
  DeviceCommand,
  DeviceCommandResult,
  DeviceEvent,
  DeviceHRVSample,
  DeviceInfo,
  DevicePairingRecord,
  DeviceSyncPayload,
  DeviceSyncSession,
  DiscoveredDevice,
} from '../../src/types';

function expectType<T>(value: T): T {
  return value;
}

const advertisement = expectType<BLEAdvertisementData>({
  localName: 'Labor Cue Band',
  manufacturerData: 'AABBCCDD',
  serviceData: {
    'service-1': 'payload',
  },
  serviceUuids: ['180F', '1810'],
  txPowerLevel: -12,
  isConnectable: true,
  rawDataBase64: 'QUJDRA==',
});

const characteristic = expectType<BLECharacteristic>({
  uuid: '2A19',
  name: 'Battery Level',
  properties: ['read', 'notify'],
  serviceUuid: '180F',
  descriptors: ['2902'],
});

const service = expectType<BLEService>({
  uuid: '180F',
  name: 'Battery Service',
  isPrimary: true,
  characteristics: [characteristic],
});

const discoveredDevice = expectType<DiscoveredDevice>({
  id: 'device-1',
  name: 'Labor Cue Band',
  localName: 'LC-Band',
  transport: 'ble',
  rssi: -62,
  availability: 'discovered',
  advertisementData: advertisement,
  lastSeenAt: '2024-02-01T00:00:00.000Z',
});

const deviceInfo = expectType<DeviceInfo>({
  id: 'device-1',
  name: 'Labor Cue Band',
  model: 'LC-01',
  transport: 'ble',
  connected: true,
  connectionStatus: 'connected',
  pairingStatus: 'paired',
  availability: 'paired',
  deviceIdentifier: 'lc-01-001',
  hardwareRevision: 'rev-a',
  batteryLevel: 92,
  lastSync: '2024-02-03T00:00:00.000Z',
  firmwareVersion: '1.2.0',
  serialNumber: 'SN-1001',
  manufacturer: 'Labor Cue',
  services: [service],
});

const pairingRecord = expectType<DevicePairingRecord>({
  deviceId: deviceInfo.id,
  pairedAt: '2024-02-01T00:00:00.000Z',
  nickname: 'Bedroom wearable',
  lastConnectedAt: '2024-02-03T00:00:00.000Z',
  autoReconnectEnabled: true,
});

const bluetoothState = expectType<BluetoothState>({
  isAvailable: true,
  isEnabled: true,
  permissionStatus: 'granted',
  connectionStatus: 'syncing',
  activeDeviceId: deviceInfo.id,
});

const command = expectType<DeviceCommand>({
  id: 'command-1',
  type: 'start_sync',
  createdAt: '2024-02-03T00:00:00.000Z',
  payload: {
    since: '2024-02-01T00:00:00.000Z',
  },
});

const commandResult = expectType<DeviceCommandResult>({
  commandId: command.id,
  success: true,
  respondedAt: '2024-02-03T00:00:01.000Z',
});

const sample = expectType<DeviceHRVSample>({
  timestamp: '2024-02-02T06:00:00.000Z',
  hrvValue: 58.4,
  sleepDuration: 7.5,
  sleepQuality: 8,
  notes: 'Normal overnight reading',
  deviceId: deviceInfo.id,
  signalQuality: 95,
});

const syncSession = expectType<DeviceSyncSession>({
  sessionId: 'session-1',
  deviceId: deviceInfo.id,
  startedAt: '2024-02-03T00:00:00.000Z',
  completedAt: '2024-02-03T00:00:10.000Z',
  status: 'completed',
  readingsReceived: 1,
});

const syncPayload = expectType<DeviceSyncPayload>({
  device: {
    id: deviceInfo.id,
    name: deviceInfo.name,
    firmwareVersion: deviceInfo.firmwareVersion,
    batteryLevel: deviceInfo.batteryLevel,
  },
  readings: [sample],
  syncedAt: '2024-02-03T00:00:10.000Z',
  hasMore: false,
});

const event = expectType<DeviceEvent>({
  id: 'event-1',
  type: 'sync_completed',
  deviceId: deviceInfo.id,
  occurredAt: '2024-02-03T00:00:10.000Z',
  message: 'Sync finished successfully',
  payload: {
    sessionId: syncSession.sessionId,
    commandId: command.id,
    result: commandResult.success,
    connectedDevice: discoveredDevice.name,
    activeState: bluetoothState.connectionStatus,
    autoReconnect: pairingRecord.autoReconnectEnabled,
    readingsImported: syncPayload.readings.length,
  },
});

void event;
