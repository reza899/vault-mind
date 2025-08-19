import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
// Define interfaces locally to avoid import issues
interface APIResponse<T = unknown> {
  status: 'success' | 'error';
  data: T;
  message?: string;
  request_id: string;
}

// VaultConfig interface moved to types/index.ts to avoid duplication

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
  include_tags?: string[];
  exclude_tags?: string[];
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

interface VaultTag {
  name: string;
  frequency: number;
  type: 'content' | 'frontmatter' | 'unknown';
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

// Collection Management types (VMIND-031)
interface Collection {
  collection_name: string;
  vault_path: string;
  description?: string;
  created_at: string;
  updated_at: string;
  last_indexed_at?: string;
  document_count: number;
  size_bytes: number;
  status: 'created' | 'indexing' | 'active' | 'error' | 'paused' | 'deleting';
  health_status: 'healthy' | 'warning' | 'error' | 'unknown';
  error_message?: string;
  chroma_exists: boolean;
}

interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_next: boolean;
  has_previous: boolean;
}

interface CollectionListResponse {
  collections: Collection[];
  pagination: PaginationInfo;
}

interface CreateCollectionRequest {
  collection_name: string;
  vault_path: string;
  description?: string;
  config?: {
    chunk_size?: number;
    chunk_overlap?: number;
    embedding_model?: string;
    ignore_patterns?: string[];
  };
}

interface CreateCollectionResponse {
  collection_id: string;
  job_id: string;
  status: string;
  estimated_indexing_time?: number;
}

interface CollectionStatus {
  collection_name: string;
  status: string;
  document_count: number;
  last_indexed_at?: string;
  health_status: string;
  error_message?: string;
  active_job?: {
    job_id: string;
    job_type: string;
    status: string;
    progress?: number;
  } | null;
}

interface CollectionHealth {
  collection_name: string;
  exists: boolean;
  accessible: boolean;
  document_count: number;
  errors: string[];
  status: 'healthy' | 'empty' | 'error';
}

interface DeleteConfirmation {
  collection_name: string;
  vault_path: string;
  document_count: number;
  size_estimate: number;
  created_at: string;
  confirmation_token: string;
  token_expires_in: number;
  warning: string;
}

class VaultMindApiClient implements ApiClient {
  private client: AxiosInstance;
  private correlationIdCounter = 0;

  constructor() {
    this.client = axios.create({
      baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api',
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

  private createApiError(error: {response?: {status: number; data?: {message?: string; detail?: string}; headers: Record<string, string>}; config?: {headers: Record<string, string>}; message: string; code?: string}): ApiError {
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

  private shouldRetry(error: {response?: {status: number}; code?: string}): boolean {
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
    const { vault_name, query, include_tags, exclude_tags, ...searchParams } = params;
    
    // Check if we need to use POST for complex parameters
    const hasComplexParams = Object.keys(searchParams).length > 0 || 
                            (include_tags && include_tags.length > 0) || 
                            (exclude_tags && exclude_tags.length > 0);
    
    if (hasComplexParams) {
      // Use POST for complex search with body parameters
      const requestBody = {
        vault_name,
        query,
        limit: searchParams.limit,
        similarity_threshold: searchParams.similarity_threshold,
        include_context: searchParams.include_context,
        filter_metadata: {
          // Remove offset as it's not expected by the backend model
          ...searchParams.filter_metadata,
          tags: {
            ...(include_tags && include_tags.length > 0 && { include: include_tags }),
            ...(exclude_tags && exclude_tags.length > 0 && { exclude: exclude_tags }),
          }
        }
      };
      
      const response = await this.post<APIResponse<{ results: SearchResult[]; total_found: number; search_time_ms: number }>>('/search', requestBody);
      return response.data;
    } else {
      // Use GET for simple search with query parameters
      const queryParams: Record<string, unknown> = { vault_name, query };
      if (include_tags && include_tags.length > 0) {
        queryParams.include_tags = include_tags.join(',');
      }
      if (exclude_tags && exclude_tags.length > 0) {
        queryParams.exclude_tags = exclude_tags.join(',');
      }
      
      const response = await this.get<APIResponse<{ results: SearchResult[]; total_found: number; search_time_ms: number }>>('/search', {
        params: queryParams,
      });
      return response.data;
    }
  }

  async getSearchableCollections(): Promise<APIResponse<{ collections: string[]; total_collections: number }>> {
    const response = await this.get<APIResponse<{ collections: string[]; total_collections: number }>>('/search/collections');
    return response.data;
  }

  async getVaultTags(vaultName: string, limit: number = 100): Promise<APIResponse<{ tags: VaultTag[]; total_tags: number; vault_name: string }>> {
    const response = await this.get<APIResponse<{ tags: VaultTag[]; total_tags: number; vault_name: string }>>(`/search/tags/${vaultName}`, {
      params: { limit }
    });
    return response.data;
  }

  // Collection Management endpoints (VMIND-031)
  async getCollections(page: number = 1, limit: number = 50): Promise<APIResponse<CollectionListResponse>> {
    const response = await this.get<APIResponse<CollectionListResponse>>('/collections', {
      params: { page, limit }
    });
    return response.data;
  }

  async createCollection(data: CreateCollectionRequest): Promise<APIResponse<CreateCollectionResponse>> {
    const response = await this.post<APIResponse<CreateCollectionResponse>>('/collections', data);
    return response.data;
  }

  async getCollectionStatus(collectionName: string): Promise<APIResponse<CollectionStatus>> {
    const response = await this.get<APIResponse<CollectionStatus>>(`/collections/${collectionName}/status`);
    return response.data;
  }

  async getCollectionHealth(collectionName: string): Promise<APIResponse<CollectionHealth>> {
    const response = await this.get<APIResponse<CollectionHealth>>(`/collections/${collectionName}/health`);
    return response.data;
  }

  async deleteCollection(collectionName: string, confirmationToken: string): Promise<APIResponse<{ status: string; cleanup_job_id: string }>> {
    const response = await this.delete<APIResponse<{ status: string; cleanup_job_id: string }>>(`/collections/${collectionName}`, {
      data: { confirmation_token: confirmationToken }
    });
    return response.data;
  }

  async getDeleteConfirmation(collectionName: string): Promise<APIResponse<DeleteConfirmation>> {
    const response = await this.delete<APIResponse<DeleteConfirmation>>(`/collections/${collectionName}`);
    return response.data;
  }

  async reindexCollection(collectionName: string, mode: string = 'incremental'): Promise<APIResponse<{ job_id: string; status: string }>> {
    const response = await this.post<APIResponse<{ job_id: string; status: string }>>(`/collections/${collectionName}/reindex`, {
      mode,
      force: false
    });
    return response.data;
  }
}

// Create singleton instance
const apiClient = new VaultMindApiClient();

export default apiClient;