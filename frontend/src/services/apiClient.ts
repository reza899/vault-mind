import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
// Define interfaces locally to avoid import issues
interface APIResponse<T = unknown> {
  status: 'success' | 'error';
  data: T;
  message?: string;
  request_id: string;
}

interface VaultConfig {
  vault_name: string;
  vault_path: string;
  description?: string;
  schedule?: {
    enabled: boolean;
    frequency: 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom';
    time?: string;
    interval?: number;
    timezone?: string;
    days_of_week?: number[];
    cron_expression?: string;
  };
  advanced?: {
    chunk_size: number;
    chunk_overlap: number;
    embedding_model: string;
    ignore_patterns: string[];
    file_types: string[];
    max_file_size_mb: number;
    parallel_processing?: boolean;
    batch_size?: number;
    custom_metadata?: Record<string, unknown>;
  };
  force_reindex?: boolean;
}

// Backend API format (matches Python Pydantic model)
interface IndexVaultRequest {
  vault_name: string;
  vault_path: string;
  description?: string;
  schedule?: string; // Cron string format
  force_reindex?: boolean;
}

interface SearchParams {
  vault_name: string;
  query: string;
  limit?: number;
  similarity_threshold?: number;
  include_context?: boolean;
  filter_metadata?: Record<string, unknown>;
}

interface SearchResult {
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

interface IndexingJob {
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
// Define service types locally to avoid import issues
interface ApiError {
  message: string;
  status?: number;
  statusText?: string;
  correlationId?: string;
  details?: unknown;
}

interface RequestConfig {
  url?: string;
  method?: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  correlationId?: string;
}

interface ResponseData<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  correlationId?: string;
}

interface ApiClient {
  get<T = unknown>(url: string, config?: RequestConfig): Promise<ResponseData<T>>;
  post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<ResponseData<T>>;
  put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<ResponseData<T>>;
  delete<T = unknown>(url: string, config?: RequestConfig): Promise<ResponseData<T>>;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: 'healthy' | 'unhealthy';
    embedding_service: 'healthy' | 'unhealthy';
  };
  timestamp: string;
}

interface SystemStatus {
  system_status: 'healthy' | 'degraded' | 'unhealthy';
  vault_collections: number;
  active_jobs: number;
  database_health: 'healthy' | 'unhealthy';
  system_metrics?: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    uptime: number;
  };
  timestamp: string;
}

class VaultMindApiClient implements ApiClient {
  private client: AxiosInstance;
  private correlationIdCounter = 0;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add correlation ID
        const correlationId = this.generateCorrelationId();
        config.headers['X-Correlation-ID'] = correlationId;
        
        // Log request in development
        if (import.meta.env.DEV) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
            correlationId,
            data: config.data,
            params: config.params,
          });
        }
        
        return config;
      },
      (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(this.createApiError(error));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const correlationId = response.headers['x-correlation-id'] || 
                            response.config.headers['X-Correlation-ID'];
        
        if (import.meta.env.DEV) {
          console.log(`[API Response] ${response.status} ${response.config.url}`, {
            correlationId,
            data: response.data,
          });
        }
        
        return response;
      },
      async (error) => {
        const apiError = this.createApiError(error);
        
        // Retry logic for network errors and 5xx responses
        if (this.shouldRetry(error) && !error.config._retry) {
          error.config._retry = true;
          
          const delay = 1000 * Math.pow(2, error.config._retryCount || 0);
          await this.sleep(delay);
          
          error.config._retryCount = (error.config._retryCount || 0) + 1;
          if (error.config._retryCount <= 3) {
            return this.client.request(error.config);
          }
        }
        
        console.error('[API Response Error]', apiError);
        return Promise.reject(apiError);
      }
    );
  }

  private generateCorrelationId(): string {
    this.correlationIdCounter += 1;
    return `fe-${Date.now()}-${this.correlationIdCounter}`;
  }

  private createApiError(error: any): ApiError {
    const correlationId = error.response?.headers['x-correlation-id'] || 
                         error.config?.headers['X-Correlation-ID'];
    
    if (error.response) {
      // Server responded with error status
      let message = error.message;
      
      // Handle different response formats
      if (error.response.data?.message) {
        message = error.response.data.message;
      } else if (error.response.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          // FastAPI validation errors
          message = detail.map(d => d.msg || d.message || String(d)).join(', ');
        } else if (typeof detail === 'string') {
          message = detail;
        } else {
          message = String(detail);
        }
      }
      
      return {
        message,
        status: error.response.status,
        statusText: error.response.statusText,
        correlationId,
        details: error.response.data,
      };
    } else if (error.request) {
      // Network error
      return {
        message: 'Network error - please check your connection',
        correlationId,
        details: error.code,
      };
    } else {
      // Other error
      return {
        message: error.message || 'An unexpected error occurred',
        correlationId,
      };
    }
  }

  private shouldRetry(error: any): boolean {
    return (
      !error.response || // Network error
      error.response.status >= 500 || // Server error
      error.code === 'ECONNABORTED' // Timeout
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Generic HTTP methods
  async get<T = unknown>(url: string, config?: RequestConfig): Promise<ResponseData<T>> {
    const response = await this.client.get<T>(url, config as AxiosRequestConfig);
    return this.formatResponse(response);
  }

  async post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<ResponseData<T>> {
    const response = await this.client.post<T>(url, data, config as AxiosRequestConfig);
    return this.formatResponse(response);
  }

  async put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<ResponseData<T>> {
    const response = await this.client.put<T>(url, data, config as AxiosRequestConfig);
    return this.formatResponse(response);
  }

  async delete<T = unknown>(url: string, config?: RequestConfig): Promise<ResponseData<T>> {
    const response = await this.client.delete<T>(url, config as AxiosRequestConfig);
    return this.formatResponse(response);
  }

  private formatResponse<T>(response: AxiosResponse<T>): ResponseData<T> {
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      correlationId: response.headers['x-correlation-id'],
    };
  }

  // API-specific methods
  
  // Health endpoints
  async getHealth(): Promise<APIResponse<HealthStatus>> {
    const response = await this.get<APIResponse<HealthStatus>>('/health');
    return response.data;
  }

  async getSystemStatus(): Promise<APIResponse<SystemStatus>> {
    const response = await this.get<APIResponse<SystemStatus>>('/status');
    return response.data;
  }

  // Indexing endpoints
  async createIndexingJob(config: IndexVaultRequest): Promise<APIResponse<{ job_id: string; vault_name: string }>> {
    const response = await this.post<APIResponse<{ job_id: string; vault_name: string }>>('/index', config);
    return response.data;
  }

  async getJobStatus(jobId: string): Promise<APIResponse<IndexingJob>> {
    const response = await this.get<APIResponse<IndexingJob>>(`/index/job/${jobId}`);
    return response.data;
  }

  async getAllJobs(): Promise<APIResponse<{ active_jobs: IndexingJob[]; recent_jobs: IndexingJob[] }>> {
    const response = await this.get<APIResponse<{ active_jobs: IndexingJob[]; recent_jobs: IndexingJob[] }>>('/index/jobs');
    return response.data;
  }

  // Search endpoints
  async searchVault(params: SearchParams): Promise<APIResponse<{ results: SearchResult[]; total_found: number; search_time_ms: number }>> {
    const { vault_name, query, ...searchParams } = params;
    
    if (Object.keys(searchParams).length > 0) {
      // Use POST for complex search with body parameters
      const response = await this.post<APIResponse<{ results: SearchResult[]; total_found: number; search_time_ms: number }>>('/search', params);
      return response.data;
    } else {
      // Use GET for simple search with query parameters
      const response = await this.get<APIResponse<{ results: SearchResult[]; total_found: number; search_time_ms: number }>>('/search', {
        params: { vault_name, query },
      });
      return response.data;
    }
  }

  async getSearchableCollections(): Promise<APIResponse<{ collections: string[]; total_collections: number }>> {
    const response = await this.get<APIResponse<{ collections: string[]; total_collections: number }>>('/search/collections');
    return response.data;
  }
}

// Create singleton instance
const apiClient = new VaultMindApiClient();

export default apiClient;