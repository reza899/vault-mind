import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define all types inline to avoid import issues
interface IndexingSchedule {
  enabled: boolean;
  frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom';
  time?: string;
  interval?: number;
  timezone?: string;
  days_of_week?: number[];
  cron_expression?: string;
}

interface VaultConfig {
  vault_name: string;
  vault_path: string;
  description?: string;
  schedule?: IndexingSchedule;
  advanced?: AdvancedConfig;
  force_reindex?: boolean;
}

interface AdvancedConfig {
  chunk_size: number;
  chunk_overlap: number;
  embedding_model: string;
  ignore_patterns: string[];
  file_types: string[];
  max_file_size_mb: number;
  parallel_processing?: boolean;
  batch_size?: number;
  custom_metadata?: Record<string, unknown>;
}

interface VaultConfigState {
  currentConfig: Partial<VaultConfig>;
  recentConfigs: VaultConfig[];
  saveConfig: (config: VaultConfig) => void;
  loadConfig: (config: VaultConfig) => void;
  resetForm: () => void;
}

const defaultSchedule: IndexingSchedule = {
  enabled: false,
  frequency: 'manual',
  time: '02:00',
  timezone: 'UTC',
};

const defaultAdvancedConfig: AdvancedConfig = {
  chunk_size: 1000,
  chunk_overlap: 200,
  embedding_model: 'all-MiniLM-L6-v2',
  ignore_patterns: ['.obsidian/**', '.trash/**', 'templates/**'],
  file_types: ['.md', '.txt'],
  max_file_size_mb: 10,
  parallel_processing: true,
  batch_size: 10,
};

export const useVaultConfigStore = create<VaultConfigState>()(
  persist(
    (set, _get) => ({
      currentConfig: {
        vault_name: '',
        vault_path: '',
        description: '',
        schedule: defaultSchedule,
        advanced: defaultAdvancedConfig,
      },
      recentConfigs: [],

      saveConfig: (config) =>
        set((state) => ({
          currentConfig: config,
          recentConfigs: [config, ...state.recentConfigs.slice(0, 9)],
        })),

      loadConfig: (config) =>
        set(() => ({
          currentConfig: config,
        })),

      resetForm: () =>
        set(() => ({
          currentConfig: {
            vault_name: '',
            vault_path: '',
            description: '',
            schedule: defaultSchedule,
            advanced: defaultAdvancedConfig,
          },
        })),
    }),
    {
      name: 'vault-config-store',
      partialize: (state) => ({
        currentConfig: state.currentConfig,
        recentConfigs: state.recentConfigs,
      }),
    }
  )
);

// Export types for use in components
export type { VaultConfig, IndexingSchedule, AdvancedConfig };