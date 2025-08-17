import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, Theme, VaultConfig } from '@/types';

interface AppStore extends AppState {
  // Theme actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Sidebar actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Vault actions
  setCurrentVault: (vault: VaultConfig | null) => void;
}

const useAppStore = create<AppStore>()(
  persist(
    (set, _get) => ({
      // Initial state
      theme: 'light',
      sidebarOpen: false,
      currentVault: null,

      // Theme actions
      setTheme: (theme: Theme) => set({ theme }),
      toggleTheme: () =>
        set(state => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      // Sidebar actions
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),

      // Vault actions
      setCurrentVault: (vault: VaultConfig | null) => set({ currentVault: vault }),
    }),
    {
      name: 'vault-mind-app-store',
      partialize: state => ({
        theme: state.theme,
        currentVault: state.currentVault,
      }),
    }
  )
);

export default useAppStore;