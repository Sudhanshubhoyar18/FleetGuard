export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export type VehicleStatus = 'ACTIVE' | 'IN_RENTAL' | 'MAINTENANCE' | 'DECOMMISSIONED';
export type ImmobilizerState = 'NORMAL' | 'IMMOBILIZED' | 'PENDING_IMMOBILIZATION';

export interface LatestLocation {
  latitude: number;
  longitude: number;
  speedKmH: number;
  headingDegrees?: number;
  timestamp: string;
  isSimulated?: boolean;
  isStale?: boolean;
}

export interface DeviceInfo {
  id: string;
  deviceId: string;
  isOnline: boolean;
  lastHeartbeatAt?: string;
  lastGpsFixAt?: string;
  cellularSignalRssi?: number;
  model: string;
  firmwareVersion: string;
  secondsSinceHeartbeat?: number;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  vin?: string;
  make: string;
  model: string;
  year: number;
  status: VehicleStatus;
  speedLimit: number;
  immobilizerState: ImmobilizerState;
  currentTripId?: string;
  createdAt: string;
  updatedAt: string;
  devices?: DeviceInfo[];
  isOnline?: boolean;
  totalDistanceKm?: number;
  latestLocation?: LatestLocation | null;
  activeRental?: RentalOrder | null;
}

export interface TelemetryPoint {
  id: string;
  deviceId: string;
  vehicleId?: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speedKmH: number;
  headingDegrees?: number;
  hdop?: number;
  satelliteCount?: number;
  isGpsValid: boolean;
  isSimulated?: boolean;
}

export type RentalStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';

export interface RentalOrder {
  id: string;
  orderNumber: string;
  vehicleId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerIdNumber?: string;
  startDateTime: string;
  expectedReturnDateTime: string;
  actualReturnDateTime?: string;
  startLocation: string;
  destinationAddress: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  allowedDistanceKm: number;
  geofenceRadiusKm?: number;
  speedLimitKmH: number;
  status: RentalStatus;
  totalDistanceTravelledKm: number;
  notes?: string;
  createdAt: string;
  vehicle?: Vehicle;
  events?: RentalEvent[];
}

export interface RentalEvent {
  id: string;
  rentalOrderId: string;
  eventType: string;
  message: string;
  timestamp: string;
  metadataJson?: string;
}

export interface SpeedAlert {
  id: string;
  vehicleId: string;
  rentalOrderId?: string;
  speedRecordedKmH: number;
  speedLimitKmH: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  vehicle?: {
    plateNumber: string;
    make: string;
    model: string;
  };
}

export interface TripPoint {
  id: string;
  latitude: number;
  longitude: number;
  speedKmH: number;
  headingDegrees?: number;
  timestamp: string;
}

export interface Trip {
  id: string;
  vehicleId: string;
  deviceId?: string;
  rentalOrderId?: string;
  startTime: string;
  endTime?: string;
  status: 'ACTIVE' | 'COMPLETED';
  startLatitude?: number;
  startLongitude?: number;
  endLatitude?: number;
  endLongitude?: number;
  totalDistanceKm: number;
  maxSpeedKmH: number;
  averageSpeedKmH: number;
  pointCount: number;
  vehicle?: {
    plateNumber: string;
    make: string;
    model: string;
  };
  rentalOrder?: {
    orderNumber: string;
    customerName: string;
  };
  points?: TripPoint[];
}

export type ImmobilizerCommandStatus = 'REQUESTED' | 'DELIVERED' | 'ACKNOWLEDGED' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface ImmobilizerCommand {
  id: string;
  vehicleId: string;
  deviceId?: string;
  commandType: 'IMMOBILIZE' | 'RESTORE';
  status: ImmobilizerCommandStatus;
  reason: string;
  requestedAt: string;
  deliveredAt?: string;
  acknowledgedAt?: string;
  completedAt?: string;
  failureReason?: string;
  isSimulated: boolean;
  vehicle?: {
    plateNumber: string;
    make: string;
    model: string;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  isRead: boolean;
  createdAt: string;
}

export interface UnifiedHistoryEvent {
  id: string;
  vehicleId?: string;
  plateNumber?: string;
  deviceId?: string;
  eventType: string;
  timestamp: string;
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
  speedKmH?: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface AppSettings {
  telegramBotTokenConfigured: boolean;
  telegramChatId: string;
  googleMapsKeyConfigured: boolean;
  heartbeatTimeoutSeconds: number;
  gpsMaxValidSpeedKmH: number;
  gpsMaxDistanceJumpKm: number;
  speedAlertCooldownSeconds: number;
  cellularModuleType: string;
}
