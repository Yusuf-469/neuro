// Web Bluetooth API Type Definitions

interface BluetoothAdvertisingEvent extends Event {
  readonly device: BluetoothDevice;
  readonly uuids: BluetoothServiceUUID[];
}

interface BluetoothCharacteristicProperties {
  readonly broadcast: boolean;
  readonly read: boolean;
  readonly writeWithoutResponse: boolean;
  readonly write: boolean;
  readonly notify: boolean;
  readonly indicate: boolean;
  readonly authenticatedSignedWrites: boolean;
  readonly reliableWrite: boolean;
  readonly writableAuxiliaries: boolean;
}

interface BluetoothCharacteristicUUID extends String { }
interface BluetoothDescriptorUUID extends String { }
interface BluetoothServiceUUID extends String { }

interface BluetoothDataFilter {
  readonly dataPrefix?: BufferSource;
  readonly mask?: BufferSource;
}

interface BluetoothManufacturerDataFilter {
  readonly companyIdentifier: number;
  readonly dataPrefix?: BufferSource;
  readonly mask?: BufferSource;
}

interface BluetoothServiceDataFilter {
  readonly service: BluetoothServiceUUID;
  readonly dataPrefix?: BufferSource;
  readonly mask?: BufferSource;
}

interface BluetoothLEScanFilter {
  readonly services?: BluetoothServiceUUID[];
  readonly name?: string;
  readonly namePrefix?: string;
  readonly manufacturerData?: BluetoothManufacturerDataFilter[];
  readonly serviceData?: BluetoothServiceDataFilter[];
}

interface BluetoothLEScanOptions {
  readonly filters?: BluetoothLEScanFilter[];
  readonly keepRepeatedDevices?: boolean;
  readonly acceptAllAdvertisements?: boolean;
}

interface BluetoothLEScan {
  readonly active: boolean;
  stop(): void;
}

interface BluetoothPermissionDescriptor {
  readonly name: 'bluetooth';
}

interface Bluetooth {
  getAvailability(): Promise<boolean>;
  getDevices(): Promise<BluetoothDevice[]>;
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
  requestLEScan(options?: BluetoothLEScanOptions): Promise<BluetoothLEScan>;
  readonly onavailabilitychanged: ((this: Bluetooth, ev: Event) => any) | null;
  addEventListener(type: 'availabilitychanged', listener: (this: Bluetooth, event: Event) => void): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: 'availabilitychanged', listener: (this: Bluetooth, event: Event) => void): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface BluetoothDevice {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
  readonly watchingAdvertisements: boolean;
  connectGATT(): Promise<BluetoothRemoteGATTServer>;
  watchAdvertisements(): Promise<void>;
  unwatchAdvertisements(): void;
  readonly onadvertisementreceived: ((this: BluetoothDevice, ev: BluetoothAdvertisingEvent) => any) | null;
  readonly ongattserverdisconnected: ((this: BluetoothDevice, ev: Event) => any) | null;
  addEventListener(type: 'advertisementreceived', listener: (this: BluetoothDevice, event: BluetoothAdvertisingEvent) => void): void;
  addEventListener(type: 'gattserverdisconnected', listener: (this: BluetoothDevice, event: Event) => void): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: 'advertisementreceived', listener: (this: BluetoothDevice, event: BluetoothAdvertisingEvent) => void): void;
  removeEventListener(type: 'gattserverdisconnected', listener: (this: BluetoothDevice, event: Event) => void): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface BluetoothRemoteGATTServer {
  readonly device: BluetoothDevice;
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService {
  readonly device: BluetoothDevice;
  readonly isPrimary: boolean;
  readonly uuid: string;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
  getIncludedService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getIncludedServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTCharacteristic {
  readonly service: BluetoothRemoteGATTService;
  readonly uuid: string;
  readonly properties: BluetoothCharacteristicProperties;
  value?: DataView;
  getDescriptor(descriptor: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor>;
  getDescriptors(descriptor?: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor[]>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: 'characteristicvaluechanged', listener: (this: BluetoothRemoteGATTCharacteristic, event: Event) => void): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: 'characteristicvaluechanged', listener: (this: BluetoothRemoteGATTCharacteristic, event: Event) => void): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface BluetoothRemoteGATTDescriptor {
  readonly characteristic: BluetoothRemoteGATTCharacteristic;
  readonly uuid: string;
  value?: DataView;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
}

interface RequestDeviceOptions {
  readonly filters?: BluetoothLEScanFilter[];
  readonly optionalServices?: BluetoothServiceUUID[];
  readonly optionalManufacturerData?: number[];
  readonly acceptAllDevices?: boolean;
}

interface Navigator {
  readonly bluetooth: Bluetooth;
}

declare const Bluetooth: {
  prototype: Bluetooth;
  new(): Bluetooth;
};

declare const BluetoothDevice: {
  prototype: BluetoothDevice;
  new(): BluetoothDevice;
};

declare const BluetoothRemoteGATTServer: {
  prototype: BluetoothRemoteGATTServer;
  new(): BluetoothRemoteGATTServer;
};

declare const BluetoothRemoteGATTService: {
  prototype: BluetoothRemoteGATTService;
  new(): BluetoothRemoteGATTService;
};

declare const BluetoothRemoteGATTCharacteristic: {
  prototype: BluetoothRemoteGATTCharacteristic;
  new(): BluetoothRemoteGATTCharacteristic;
};
