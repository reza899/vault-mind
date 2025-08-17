// API Service Types
export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
}

export interface ApiError {
  message: string;
  status?: number;
  statusText?: string;
  correlationId?: string;
  details?: unknown;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: ApiError) => boolean;
}

// Request/Response interceptor types
export interface RequestConfig {
  url?: string;
  method?: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  correlationId?: string;
}

export interface ResponseData<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  correlationId?: string;
}

// API Client interface
export interface ApiClient {
  get<T = unknown>(url: string, config?: RequestConfig): Promise<ResponseData<T>>;
  post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<ResponseData<T>>;
  put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<ResponseData<T>>;
  delete<T = unknown>(url: string, config?: RequestConfig): Promise<ResponseData<T>>;
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: 'healthy' | 'unhealthy';
    embedding_service: 'healthy' | 'unhealthy';
  };
  timestamp: string;
}

// System status types
export interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  uptime: number;
}

export interface SystemStatus {
  system_status: 'healthy' | 'degraded' | 'unhealthy';
  vault_collections: number;
  active_jobs: number;
  database_health: 'healthy' | 'unhealthy';
  system_metrics?: SystemMetrics;
  timestamp: string;
}