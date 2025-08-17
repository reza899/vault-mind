import React from 'react';
import { useConnectionStatus } from '@/hooks/useApi';
import { useWebSocket } from '@/hooks';

interface ConnectionStatusProps {
  showDetails?: boolean;
  className?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showDetails = false,
  className = '',
}) => {
  const { isConnected, isConnecting, error, lastSuccessful } = useConnectionStatus();
  const { connectionStatus: wsStatus } = useWebSocket();

  const getStatus = () => {
    if (isConnecting) return 'connecting';
    if (isConnected && wsStatus === 'connected') return 'connected';
    if (isConnected && wsStatus !== 'connected') return 'api-only';
    return 'disconnected';
  };

  const status = getStatus();

  const getStatusColor = (): string => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'api-only':
        return 'text-yellow-500';
      case 'connecting':
        return 'text-blue-500';
      default:
        return 'text-red-500';
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'api-only':
        return 'API Connected';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Disconnected';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return (
          <div className='flex'>
            <div className={`h-2 w-2 rounded-full ${getStatusColor()} bg-current`} />
            <div className={`h-2 w-2 rounded-full ${getStatusColor()} bg-current ml-1`} />
          </div>
        );
      case 'api-only':
        return (
          <div className='flex'>
            <div className={`h-2 w-2 rounded-full ${getStatusColor()} bg-current`} />
            <div className='h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600 ml-1' />
          </div>
        );
      case 'connecting':
        return (
          <div className={`h-2 w-2 rounded-full ${getStatusColor()} bg-current animate-pulse`} />
        );
      default:
        return (
          <div className={`h-2 w-2 rounded-full ${getStatusColor()} bg-current`} />
        );
    }
  };

  const formatLastSuccessful = (): string => {
    if (!lastSuccessful) return 'Never';
    const now = Date.now();
    const diff = now - lastSuccessful;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (!showDetails) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {getStatusIcon()}
        <span className={`text-xs font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className='flex items-center space-x-2 mb-2'>
        {getStatusIcon()}
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>
      
      <div className='text-xs text-gray-500 dark:text-gray-400 space-y-1'>
        <div className='flex justify-between'>
          <span>API:</span>
          <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className='flex justify-between'>
          <span>WebSocket:</span>
          <span className={
            wsStatus === 'connected' 
              ? 'text-green-500' 
              : wsStatus === 'connecting' 
                ? 'text-blue-500' 
                : 'text-red-500'
          }>
            {wsStatus === 'connected' ? 'Connected' : 
             wsStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
          </span>
        </div>
        {lastSuccessful && (
          <div className='flex justify-between'>
            <span>Last Successful:</span>
            <span>{formatLastSuccessful()}</span>
          </div>
        )}
        {error && (
          <div className='mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400'>
            <div className='text-xs'>
              {error.message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;