import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear auth and redirect
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/onboarding';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  verifyOtp: (idToken: string) =>
    api.post<{ token: string; worker: Worker }>('/auth/otp-verify', { idToken }),
};

export const workersApi = {
  register: (data: RegisterPayload) => api.post('/workers/register', data),
  getCoverage: (id: string) => api.get<CoverageResponse>(`/workers/${id}/coverage`),
  getPayouts: (id: string) => api.get<PayoutsResponse>(`/workers/${id}/payouts`),
  getPremium: (id: string) => api.get<PremiumResponse>(`/workers/${id}/premium`),
  getZones: () => api.get<{ zones: Zone[] }>('/workers/'),
};

export const subscriptionsApi = {
  setupMandate: (data: MandatePayload) => api.post('/subscriptions/mandate', data),
};

export const triggersApi = {
  getActive: (zoneId?: string) =>
    api.get<{ triggers: TriggerEvent[] }>('/triggers/active', { params: { zoneId } }),
};

// Types
export interface Worker {
  id: string; phone: string; name: string | null;
  tier: string; isNewUser: boolean;
}
export interface Zone { id: string; city: string; display_name: string; flood_history_score: number; aqi_frequency_score: number; }
export interface RegisterPayload { name: string; zoneId: string; platform: string; avgDailyEarning?: number; platformTenureMonths?: number; language?: string; }
export interface MandatePayload { upiId: string; tier: string; }
export interface CoverageResponse { policy: Policy | null; activeTrigger: TriggerEvent | null; isCovered: boolean; }
export interface Policy { id: string; tier: string; week_start: string; week_end: string; final_premium: number; zone_name: string; city: string; }
export interface PayoutsResponse { payouts: PayoutRecord[]; }
export interface PayoutRecord { id: string; payout_amount: number; status: string; created_at: string; trigger_type: string; utr?: string; completed_at?: string; }
export interface PremiumResponse { premium: { final_premium: number; base_premium: number; tier: string; week_start: string; week_end: string; premium_factors: Record<string, number>; } | null; }
export interface TriggerEvent { id: string; trigger_type: string; severity: string; started_at: string; zone_name: string; }
