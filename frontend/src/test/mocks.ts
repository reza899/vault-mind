import { vi } from 'vitest';
import { APIResponse, VaultConfig, IndexingJob, SearchResult } from '@/types';

// Mock axios
export const mockAxios = {
  create: vi.fn(() => mockAxios),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: {
      use: vi.fn(),
    },
    response: {
      use: vi.fn(),
    },
  },
};

vi.mock('axios', () => ({
  default: mockAxios,
}));

// Mock API responses
export const mockApiResponse = <T>(data: T): APIResponse<T> => ({
  status: 'success',
  data,
  request_id: 'test-123',
});

export const mockApiError = (message: string, _status = 500): APIResponse<never> => ({
  status: 'error',
  data: null as never,
  message,
  request_id: 'test-123',
});

// Mock data factories
export const createMockVaultConfig = (overrides: Partial<VaultConfig> = {}): VaultConfig => ({
  vault_name: 'test_vault',
  vault_path: '/test/path',
  description: 'Test vault',
  ...overrides,
});

export const createMockIndexingJob = (overrides: Partial<IndexingJob> = {}): IndexingJob => ({
  job_id: 'job-123',
  vault_name: 'test_vault',
  status: 'running',
  progress: 50,
  files_processed: 5,
  total_files: 10,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockSearchResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  content: 'Test content',
  metadata: {
    file_path: '/test/file.md',
    chunk_index: 0,
    file_type: 'markdown',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides.metadata,
  },
  similarity_score: 0.8,
  ...overrides,
});

// Mock HTTP responses
export const mockSuccessResponse = <T>(data: T, status = 200) => ({
  data: mockApiResponse(data),
  status,
  statusText: 'OK',
  headers: {
    'x-correlation-id': 'test-123',
  },
  config: {},
});

export const mockErrorResponse = (message: string, status = 500) => {
  const error = new Error(message) as any;
  error.response = {
    data: mockApiError(message, status),
    status,
    statusText: 'Internal Server Error',
    headers: {},
  };
  error.config = {};
  return error;
};

// Test utilities
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0));

export const flushPromises = () => new Promise(resolve => setImmediate(resolve));