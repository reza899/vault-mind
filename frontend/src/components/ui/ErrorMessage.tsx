import React from 'react';
import { ApiError } from '@/services/types';

interface ErrorMessageProps {
  error: ApiError | Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showDetails?: boolean;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
  showDetails = false,
}) => {
  if (!error) return null;

  const isApiError = (err: any): err is ApiError => {
    return err && typeof err === 'object' && 'message' in err;
  };

  const apiError = isApiError(error) ? error : null;
  const message = apiError?.message || error.message || 'An unexpected error occurred';
  const status = apiError?.status;
  const correlationId = apiError?.correlationId;

  const getErrorType = (): string => {
    if (!status) return 'error';
    if (status >= 500) return 'server-error';
    if (status >= 400) return 'client-error';
    return 'error';
  };

  const getIconColor = (): string => {
    const type = getErrorType();
    switch (type) {
      case 'server-error':
        return 'text-red-500';
      case 'client-error':
        return 'text-orange-500';
      default:
        return 'text-red-500';
    }
  };

  const getBackgroundColor = (): string => {
    const type = getErrorType();
    switch (type) {
      case 'server-error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'client-error':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      default:
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${getBackgroundColor()} ${className}`}>
      <div className='flex items-start'>
        <div className={`flex-shrink-0 ${getIconColor()}`}>
          <svg
            className='h-5 w-5'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
        </div>
        
        <div className='ml-3 flex-1'>
          <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
            Error
            {status && ` (${status})`}
          </h3>
          <p className='mt-1 text-sm text-gray-700 dark:text-gray-300'>
            {message}
          </p>
          
          {showDetails && correlationId && (
            <p className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
              Correlation ID: {correlationId}
            </p>
          )}
          
          {showDetails && apiError?.details && (
            <details className='mt-2'>
              <summary className='text-xs text-gray-500 dark:text-gray-400 cursor-pointer'>
                Technical Details
              </summary>
              <pre className='mt-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto'>
                {JSON.stringify(apiError.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
        
        <div className='ml-4 flex-shrink-0 flex space-x-2'>
          {onRetry && (
            <button
              onClick={onRetry}
              className='text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300'
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className='text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
            >
              <svg className='h-4 w-4' fill='currentColor' viewBox='0 0 20 20'>
                <path
                  fillRule='evenodd'
                  d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                  clipRule='evenodd'
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;