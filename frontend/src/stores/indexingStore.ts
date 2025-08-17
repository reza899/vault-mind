import { create } from 'zustand';
import { IndexingState, IndexingJob, IndexingProgressMessage } from '@/types';
import { ConnectionStatus } from '@/hooks/useWebSocket';

interface IndexingStore extends IndexingState {
  // Connection state
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Job management
  addJob: (job: IndexingJob) => void;
  updateJob: (jobId: string, updates: Partial<IndexingJob>) => void;
  removeJob: (jobId: string) => void;
  clearJobs: () => void;

  // Progress updates
  addProgressUpdate: (update: IndexingProgressMessage) => void;
  removeProgressUpdate: (jobId: string) => void;
  clearProgressUpdates: () => void;

  // WebSocket message handling
  handleWebSocketMessage: (message: any) => void;

  // Utility functions
  getActiveJobs: () => IndexingJob[];
  getCompletedJobs: () => IndexingJob[];
  getJobById: (jobId: string) => IndexingJob | undefined;
  getProgressByJobId: (jobId: string) => IndexingProgressMessage | undefined;
}

const useIndexingStore = create<IndexingStore>((set, get) => ({
  // Initial state
  activeJobs: new Map(),
  connectionStatus: 'disconnected',
  progressUpdates: new Map(),

  // Connection state actions
  setConnectionStatus: (status: ConnectionStatus) =>
    set({ connectionStatus: status }),

  // Job management actions
  addJob: (job: IndexingJob) =>
    set(state => ({
      activeJobs: new Map(state.activeJobs).set(job.job_id, job),
    })),

  updateJob: (jobId: string, updates: Partial<IndexingJob>) =>
    set(state => {
      const newJobs = new Map(state.activeJobs);
      const existingJob = newJobs.get(jobId);
      if (existingJob) {
        newJobs.set(jobId, { ...existingJob, ...updates });
      }
      return { activeJobs: newJobs };
    }),

  removeJob: (jobId: string) =>
    set(state => {
      const newJobs = new Map(state.activeJobs);
      newJobs.delete(jobId);
      const newProgress = new Map(state.progressUpdates);
      newProgress.delete(jobId);
      return { 
        activeJobs: newJobs,
        progressUpdates: newProgress,
      };
    }),

  clearJobs: () =>
    set({
      activeJobs: new Map(),
      progressUpdates: new Map(),
    }),

  // Progress update actions
  addProgressUpdate: (update: IndexingProgressMessage) =>
    set(state => ({
      progressUpdates: new Map(state.progressUpdates).set(update.job_id, update),
    })),

  removeProgressUpdate: (jobId: string) =>
    set(state => {
      const newProgress = new Map(state.progressUpdates);
      newProgress.delete(jobId);
      return { progressUpdates: newProgress };
    }),

  clearProgressUpdates: () =>
    set({ progressUpdates: new Map() }),

  // WebSocket message handling
  handleWebSocketMessage: (message: any) => {
    const { type, data } = message;

    switch (type) {
      case 'indexing_progress': {
        const progressMessage: IndexingProgressMessage = {
          type: 'indexing_progress',
          data: data,
          timestamp: message.timestamp || Date.now(),
          job_id: data.job_id,
          vault_name: data.vault_name,
          files_processed: data.files_processed,
          total_files: data.total_files,
          current_file: data.current_file,
          progress_percent: data.progress_percent,
          processing_rate: data.processing_rate,
        };
        
        get().addProgressUpdate(progressMessage);
        
        // Update job status if it exists
        const job = get().getJobById(data.job_id);
        if (job) {
          get().updateJob(data.job_id, {
            progress: data.progress_percent,
            files_processed: data.files_processed,
            total_files: data.total_files,
            current_file: data.current_file,
          });
        }
        break;
      }

      case 'indexing_started': {
        const job: IndexingJob = {
          job_id: data.job_id,
          vault_name: data.vault_name,
          status: 'running',
          progress: 0,
          files_processed: 0,
          total_files: data.total_files || 0,
          created_at: data.created_at || new Date().toISOString(),
        };
        get().addJob(job);
        break;
      }

      case 'indexing_completed': {
        get().updateJob(data.job_id, {
          status: 'completed',
          progress: 100,
          completed_at: data.completed_at || new Date().toISOString(),
        });
        // Remove progress updates for completed jobs after a delay
        setTimeout(() => {
          get().removeProgressUpdate(data.job_id);
        }, 5000);
        break;
      }

      case 'indexing_failed': {
        get().updateJob(data.job_id, {
          status: 'failed',
          error_message: data.error_message,
          completed_at: data.completed_at || new Date().toISOString(),
        });
        get().removeProgressUpdate(data.job_id);
        break;
      }

      case 'indexing_cancelled': {
        get().updateJob(data.job_id, {
          status: 'cancelled',
          completed_at: data.completed_at || new Date().toISOString(),
        });
        get().removeProgressUpdate(data.job_id);
        break;
      }

      default:
        console.log('[IndexingStore] Unhandled message type:', type);
    }
  },

  // Utility functions
  getActiveJobs: () => {
    const jobs = Array.from(get().activeJobs.values());
    return jobs.filter(job => job.status === 'running' || job.status === 'queued');
  },

  getCompletedJobs: () => {
    const jobs = Array.from(get().activeJobs.values());
    return jobs.filter(job => 
      job.status === 'completed' || 
      job.status === 'failed' || 
      job.status === 'cancelled'
    );
  },

  getJobById: (jobId: string) => {
    return get().activeJobs.get(jobId);
  },

  getProgressByJobId: (jobId: string) => {
    return get().progressUpdates.get(jobId);
  },
}));

export default useIndexingStore;