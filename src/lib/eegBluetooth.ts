import type { EEGStream, EEGDevice } from '../types/eeg';

// Bluetooth UUIDs for different EEG devices
const MUSE_SERVICE_UUID = '0000fe8d-0000-1000-8000-00805f9b34fb';
const MUSE_CHARACTERISTIC_UUID = '273c0000-4c4d-454d-96be-f03bac821358';

const OPENBCI_SERVICE_UUID = '0000fefb-0000-1000-8000-00805f9b34fb';
const OPENBCI_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

// Generic EEG service (for custom devices)
const GENERIC_EEG_SERVICE_UUID = '0000eeg0-0000-1000-8000-00805f9b34fb';

export type EEGDeviceType = 'muse' | 'openbci' | 'generic';

interface BluetoothConnection {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  service: BluetoothRemoteGATTService;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

class EEGBluetoothManager {
  private connection: BluetoothConnection | null = null;
  private onDataCallback: ((data: EEGStream) => void) | null = null;
  private onStatusCallback: ((status: string) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  
  // Check if Bluetooth is available
  isAvailable(): boolean {
    return 'bluetooth' in navigator;
  }
  
  // Scan for EEG devices
  async scanForDevices(): Promise<EEGDevice[]> {
    if (!this.isAvailable()) {
      throw new Error('Web Bluetooth is not supported in this browser');
    }
    
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [MUSE_SERVICE_UUID] },
          { services: [OPENBCI_SERVICE_UUID] },
          { namePrefix: 'Muse' },
          { namePrefix: 'OpenBCI' },
          { namePrefix: 'Ganglion' },
        ],
        optionalServices: ['battery_service', 'device_information'],
      });
      
      return [{
        id: device.id,
        name: device.name || 'Unknown EEG Device',
        type: this.detectDeviceType(device),
        batteryLevel: 100,
        signalQuality: 0,
        connected: false,
        samplingRate: 256,
      }];
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return [];
      }
      throw error;
    }
  }
  
  // Connect to a specific device
  async connect(deviceId?: string): Promise<EEGDevice> {
    if (!this.isAvailable()) {
      throw new Error('Web Bluetooth is not supported');
    }
    
    this.notifyStatus('Connecting to EEG device...');
    
    let device: BluetoothDevice;
    
    if (deviceId && this.connection?.device.id === deviceId) {
      device = this.connection.device;
    } else {
      // Request device selection
      device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [MUSE_SERVICE_UUID] },
          { services: [OPENBCI_SERVICE_UUID] },
          { namePrefix: 'Muse' },
          { namePrefix: 'OpenBCI' },
          { namePrefix: 'Ganglion' },
        ],
        optionalServices: ['battery_service', 'device_information'],
      });
    }
    
    // Setup disconnect handler
    device.addEventListener('gattserverdisconnected', () => {
      this.handleDisconnect();
    });
    
    // Connect to GATT server
    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error('Failed to connect to GATT server');
    }
    
    this.notifyStatus('Connected to GATT server');
    
    // Get service and characteristic based on device type
    const deviceType = this.detectDeviceType(device);
    const { service, characteristic } = await this.getServiceAndCharacteristic(server, deviceType);
    
    this.connection = {
      device,
      server,
      service,
      characteristic,
    };
    
    // Enable notifications
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      this.handleDataChange(event, deviceType);
    });
    
    // Get battery level if available
    let batteryLevel = 100;
    try {
      const batteryService = await server.getPrimaryService('battery_service');
      const batteryChar = await batteryService.getCharacteristic('battery_level');
      const batteryValue = await batteryChar.readValue();
      batteryLevel = batteryValue.getUint8(0);
    } catch {
      // Battery service not available
    }
    
    this.reconnectAttempts = 0;
    this.notifyStatus('EEG device connected and streaming');
    
    return {
      id: device.id,
      name: device.name || 'EEG Device',
      type: deviceType,
      batteryLevel,
      signalQuality: 100,
      connected: true,
      samplingRate: 256,
    };
  }
  
  // Disconnect from current device
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.characteristic.stopNotifications();
        this.connection.server.disconnect();
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
      this.connection = null;
      this.notifyStatus('Disconnected from EEG device');
    }
  }
  
  // Set data callback
  onData(callback: (data: EEGStream) => void): void {
    this.onDataCallback = callback;
  }
  
  // Set status callback
  onStatus(callback: (status: string) => void): void {
    this.onStatusCallback = callback;
  }
  
  // Check if connected
  isConnected(): boolean {
    return this.connection !== null && this.connection.device.gatt?.connected === true;
  }
  
  // Private methods
  private detectDeviceType(device: BluetoothDevice): EEGDeviceType {
    const name = device.name?.toLowerCase() || '';
    
    if (name.includes('muse')) return 'muse';
    if (name.includes('openbci') || name.includes('ganglion')) return 'openbci';
    return 'generic';
  }
  
  private async getServiceAndCharacteristic(
    server: BluetoothRemoteGATTServer,
    deviceType: EEGDeviceType
  ): Promise<{ service: BluetoothRemoteGATTService; characteristic: BluetoothRemoteGATTCharacteristic }> {
    let serviceUuid: string;
    let charUuid: string;
    
    switch (deviceType) {
      case 'muse':
        serviceUuid = MUSE_SERVICE_UUID;
        charUuid = MUSE_CHARACTERISTIC_UUID;
        break;
      case 'openbci':
        serviceUuid = OPENBCI_SERVICE_UUID;
        charUuid = OPENBCI_CHARACTERISTIC_UUID;
        break;
      default:
        serviceUuid = GENERIC_EEG_SERVICE_UUID;
        charUuid = '00002a37-0000-1000-8000-00805f9b34fb';
    }
    
    const service = await server.getPrimaryService(serviceUuid);
    const characteristic = await service.getCharacteristic(charUuid);
    
    return { service, characteristic };
  }
  
  private handleDataChange(event: Event, deviceType: EEGDeviceType): void {
    const target = event.target as unknown as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    
    if (!value || !this.onDataCallback) return;
    
    try {
      const eegData = this.parseEEGData(value, deviceType);
      this.onDataCallback(eegData);
    } catch (error) {
      console.error('Error parsing EEG data:', error);
    }
  }
  
  private parseEEGData(data: DataView, deviceType: EEGDeviceType): EEGStream {
    const timestamp = Date.now();
    
    switch (deviceType) {
      case 'muse':
        return this.parseMuseData(data, timestamp);
      case 'openbci':
        return this.parseOpenBCIData(data, timestamp);
      default:
        return this.parseGenericData(data, timestamp);
    }
  }
  
  private parseMuseData(data: DataView, timestamp: number): EEGStream {
    // Muse sends 12-bit packed EEG data
    // This is a simplified parser - real implementation needs bit unpacking
    const raw = new Float32Array(4);
    const channels = {
      tp9: 0,
      af7: 0,
      af8: 0,
      tp10: 0,
    };
    
    // Parse Muse packet format
    // Each packet contains multiple samples packed together
    const packetLength = data.byteLength;
    
    if (packetLength >= 20) {
      // Extract 12-bit values (simplified)
      for (let i = 0; i < 4; i++) {
        const offset = i * 3;
        const value = (data.getUint16(offset, true) & 0x0FFF) - 2048;
        const channelIndex = ['tp9', 'af7', 'af8', 'tp10'][i] as keyof typeof channels;
        channels[channelIndex] = value * 0.488; // Convert to microvolts
        raw[i] = channels[channelIndex];
      }
    }
    
    return { timestamp, channels, raw };
  }
  
  private parseOpenBCIData(data: DataView, timestamp: number): EEGStream {
    // OpenBCI Ganglion sends 24-bit signed values
    const raw = new Float32Array(4);
    const channels = {
      tp9: 0,
      af7: 0,
      af8: 0,
      tp10: 0,
    };
    
    // Parse OpenBCI packet (simplified)
    if (data.byteLength >= 33) {
      for (let i = 0; i < 4; i++) {
        const offset = 1 + i * 8; // Skip packet start byte
        const value = this.parse24BitSigned(data, offset);
        const channelIndex = ['tp9', 'af7', 'af8', 'tp10'][i] as keyof typeof channels;
        channels[channelIndex] = value * 0.02235; // Scale factor for Ganglion
        raw[i] = channels[channelIndex];
      }
    }
    
    return { timestamp, channels, raw };
  }
  
  private parseGenericData(data: DataView, timestamp: number): EEGStream {
    // Generic format: 4 x 16-bit signed integers
    const raw = new Float32Array(4);
    const channels = {
      tp9: 0,
      af7: 0,
      af8: 0,
      tp10: 0,
    };
    
    if (data.byteLength >= 8) {
      channels.tp9 = data.getInt16(0, true);
      channels.af7 = data.getInt16(2, true);
      channels.af8 = data.getInt16(4, true);
      channels.tp10 = data.getInt16(6, true);
      
      raw[0] = channels.tp9;
      raw[1] = channels.af7;
      raw[2] = channels.af8;
      raw[3] = channels.tp10;
    }
    
    return { timestamp, channels, raw };
  }
  
  private parse24BitSigned(data: DataView, offset: number): number {
    const b0 = data.getUint8(offset);
    const b1 = data.getUint8(offset + 1);
    const b2 = data.getUint8(offset + 2);
    
    let value = (b0 << 16) | (b1 << 8) | b2;
    
    // Sign extend if negative
    if (value & 0x800000) {
      value |= ~0xFFFFFF;
    }
    
    return value;
  }
  
  private handleDisconnect(): void {
    this.connection = null;
    this.notifyStatus('EEG device disconnected');
    
    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.notifyStatus(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, 2000);
    }
  }
  
  private notifyStatus(status: string): void {
    if (this.onStatusCallback) {
      this.onStatusCallback(status);
    }
  }
}

// Singleton instance
export const eegBluetooth = new EEGBluetoothManager();

// Hook for React components
export function useEEGBluetooth() {
  return {
    isAvailable: eegBluetooth.isAvailable(),
    scanForDevices: eegBluetooth.scanForDevices.bind(eegBluetooth),
    connect: eegBluetooth.connect.bind(eegBluetooth),
    disconnect: eegBluetooth.disconnect.bind(eegBluetooth),
    onData: eegBluetooth.onData.bind(eegBluetooth),
    onStatus: eegBluetooth.onStatus.bind(eegBluetooth),
    isConnected: eegBluetooth.isConnected.bind(eegBluetooth),
  };
}