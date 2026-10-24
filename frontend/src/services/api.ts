import type {
  Vehicle,
  DeviceInfo,
  RentalOrder,
  SpeedAlert,
  Trip,
  ImmobilizerCommand,
  NotificationItem,
  UnifiedHistoryEvent,
  AppSettings,
  User
} from '../types/index.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('fleetguard_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res);
  },

  async register(data: { email: string; password: string; name: string; role?: string }): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    const res = await fetch(`${API_BASE}/vehicles`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getVehicleById(id: string): Promise<Vehicle> {
    const res = await fetch(`${API_BASE}/vehicles/${id}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    const res = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateVehicle(id: string, data: Partial<Vehicle> & { deviceId?: string }): Promise<Vehicle> {
    const res = await fetch(`${API_BASE}/vehicles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async getVehicleLocation(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/vehicles/${id}/location`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getVehicleHistory(id: string, limit: number = 200): Promise<any[]> {
    const res = await fetch(`${API_BASE}/vehicles/${id}/history?limit=${limit}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Devices
  async getDevices(): Promise<DeviceInfo[]> {
    const res = await fetch(`${API_BASE}/devices`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async registerDevice(data: { deviceId: string; model?: string; firmwareVersion?: string; vehicleId?: string }): Promise<DeviceInfo> {
    const res = await fetch(`${API_BASE}/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async getDeviceStatus(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/devices/${id}/status`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Trips
  async getTrips(vehicleId?: string): Promise<Trip[]> {
    const url = vehicleId ? `${API_BASE}/trips?vehicleId=${vehicleId}` : `${API_BASE}/trips`;
    const res = await fetch(url, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getTripById(id: string): Promise<Trip> {
    const res = await fetch(`${API_BASE}/trips/${id}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async startTrip(data: { vehicleId: string; rentalOrderId?: string }): Promise<Trip> {
    const res = await fetch(`${API_BASE}/trips/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async endTrip(id: string): Promise<Trip> {
    const res = await fetch(`${API_BASE}/trips/${id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({})
    });
    return handleResponse(res);
  },

  // Rentals
  async getRentals(status?: string): Promise<RentalOrder[]> {
    const url = status ? `${API_BASE}/rentals?status=${status}` : `${API_BASE}/rentals`;
    const res = await fetch(url, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async getRentalById(id: string): Promise<RentalOrder> {
    const res = await fetch(`${API_BASE}/rentals/${id}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async createRental(data: Partial<RentalOrder>): Promise<RentalOrder> {
    const res = await fetch(`${API_BASE}/rentals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async completeRental(id: string): Promise<RentalOrder> {
    const res = await fetch(`${API_BASE}/rentals/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({})
    });
    return handleResponse(res);
  },

  // Alerts
  async getAlerts(isAcknowledged?: boolean): Promise<SpeedAlert[]> {
    const url = isAcknowledged !== undefined ? `${API_BASE}/alerts?isAcknowledged=${isAcknowledged}` : `${API_BASE}/alerts`;
    const res = await fetch(url, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async acknowledgeAlert(id: string): Promise<SpeedAlert> {
    const res = await fetch(`${API_BASE}/alerts/${id}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({})
    });
    return handleResponse(res);
  },

  // History
  async getHistory(params: {
    vehicleId?: string;
    eventType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: UnifiedHistoryEvent[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params.vehicleId) query.set('vehicleId', params.vehicleId);
    if (params.eventType) query.set('eventType', params.eventType);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/history?${query.toString()}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  getHistoryExportUrl(vehicleId?: string): string {
    return vehicleId ? `${API_BASE}/history/export?vehicleId=${vehicleId}` : `${API_BASE}/history/export`;
  },

  // Immobilizer
  async getImmobilizerStatus(vehicleId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/immobilizer/status`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async submitImmobilizerCommand(params: {
    vehicleId: string;
    commandType: 'IMMOBILIZE' | 'RESTORE';
    reason: string;
    isSimulated?: boolean;
  }): Promise<{ command: ImmobilizerCommand; isMovingUnsafe: boolean; currentSpeed: number; warning?: string }> {
    const res = await fetch(`${API_BASE}/vehicles/${params.vehicleId}/immobilizer/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(params)
    });
    return handleResponse(res);
  },

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async markNotificationRead(id: string): Promise<NotificationItem> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({})
    });
    return handleResponse(res);
  },

  async testTelegramNotification(chatId?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/notifications/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ chatId })
    });
    return handleResponse(res);
  },

  // Settings
  async getSettings(): Promise<AppSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  async updateSettings(data: Partial<AppSettings> & { telegramBotToken?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  }
};
