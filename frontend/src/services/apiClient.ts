import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  APIResponse, 
  VaultConfig, 
  SearchParams, 
  SearchResult, 
  IndexingJob 
} from '@/types';
import { 
  ApiClient, 
  ApiError, 
  RequestConfig, 
  ResponseData, 
  HealthStatus,
  SystemStatus 
} from './types';

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
      return {
        message: error.response.data?.message || error.response.data?.detail || error.message,
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
  async createIndexingJob(config: VaultConfig): Promise<APIResponse<{ job_id: string; vault_name: string }>> {
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