import React from 'react';
import { useRealtime } from '../../contexts/RealtimeContext';

interface ConnectionStatusProps {
  className?: string;
  showText?: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  className = '', 
  showText = true 
}) => {
  const { connectionStatus, isDataStale } = useRealtime();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          icon: '●',
          text: 'Connected',
          description: 'Real-time sync active'
        };
      case 'disconnected':
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: '○',
          text: 'Disconnected',
          description: 'No connection'
        };
      case 'reconnecting':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          icon: '◐',
          text: 'Reconnecting',
          description: 'Attempting to reconnect...'
        };
      case 'error':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: '●',
          text: 'Error',
          description: 'Connection error'
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          icon: '○',
          text: 'Unknown',
          description: 'Unknown status'
        };
    }
  };

  const config = getStatusConfig();
  const dataStale = isDataStale();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div 
        className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${config.bgColor}`}
        title={`${config.description}${dataStale ? ' (Data may be stale)' : ''}`}
      >
        <span className={`${config.color} animate-pulse`}>
          {config.icon}
        </span>
        {showText && (
          <span className={config.color}>
            {config.text}
            {dataStale && ' (Stale)'}
          </span>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;