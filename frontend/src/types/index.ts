// API Response Types
export interface APIResponse<T = unknown> {
  status: 'success' | 'error';
  data: T;
  message?: string;
  request_id: string;
}

// Vault Configuration Types
export interface IndexingSchedule {
  enabled: boolean;
  frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom';
  time?: string; // HH:MM format for daily/weekly
  interval?: number; // For hourly (hours) or custom (minutes)
  timezone?: string; // IANA timezone
  days_of_week?: number[]; // 0-6, Sunday=0, for weekly frequency
  cron_expression?: string; // For custom frequency
}

export interface AdvancedConfig {
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

export interface VaultConfig {
  vault_name: string;
  vault_path: string;
  description?: string;
  schedule?: IndexingSchedule;
  advanced?: AdvancedConfig;
  force_reindex?: boolean;
}

// Search Types
export interface SearchParams {
  vault_name: string;
  query: string;
  limit?: number;
  similarity_threshold?: number;
  include_context?: boolean;
  filter_metadata?: Record<string, unknown>;
}

export interface SearchResult {
  content: string;
  metadata: {
    file_path: string;
    chunk_index: number;
    file_type: string;
    created_at?: string;
    modified_at?: string;
    tags?: string[];
  };
  similarity_score: number;
}

// Job Management Types
export interface IndexingJob {
  job_id: string;
  vault_name: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  files_processed?: number;
  total_files?: number;
  current_file?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

export interface IndexingProgressMessage extends WebSocketMessage {
  type: 'indexing_progress';
  job_id: string;
  vault_name: string;
  files_processed: number;
  total_files: number;
  current_file?: string;
  progress_percent: number;
  processing_rate?: number;
}

// Theme Types
export type Theme = 'light' | 'dark';

// Store Types
export interface AppState {
  theme: Theme;
  sidebarOpen: boolean;
  currentVault: VaultConfig | null;
}

export interface IndexingState {
  activeJobs: Map<string, IndexingJob>;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  progressUpdates: Map<string, IndexingProgressMessage>;
}