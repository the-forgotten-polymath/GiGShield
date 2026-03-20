import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Worker } from '../lib/api';

interface AuthState {
  token: string | null;
  worker: Worker | null;
  setAuth: (token: string, worker: Worker) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      worker: null,
      setAuth: (token, worker) => set({ token, worker }),
      logout: () => set({ token: null, worker: null }),
    }),
    { name: 'gigshield-auth' }
  )
);
