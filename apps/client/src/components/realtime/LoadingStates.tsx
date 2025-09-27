import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 w-full h-full"></div>
    </div>
  );
};

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  lines = 1 
}) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`bg-gray-200 rounded ${index > 0 ? 'mt-2' : ''}`}
          style={{
            height: '1rem',
            width: `${Math.random() * 40 + 60}%` // Random width between 60-100%
          }}
        />
      ))}
    </div>
  );
};

interface DataLoadingStateProps {
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  retryAction?: () => void;
}

export const DataLoadingState: React.FC<DataLoadingStateProps> = ({
  loading,
  error,
  children,
  loadingComponent,
  errorComponent,
  retryAction
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        {loadingComponent || (
          <div className="text-center">
            <LoadingSpinner size="lg" className="mx-auto mb-4" />
            <p className="text-gray-600">Loading real-time data...</p>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        {errorComponent || (
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Connection Error
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            {retryAction && (
              <button
                onClick={retryAction}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
};

interface RealtimeDataTableProps {
  data: any[];
  loading: boolean;
  error: string | null;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, item: any) => React.ReactNode;
  }>;
  onRetry?: () => void;
  emptyMessage?: string;
}

export const RealtimeDataTable: React.FC<RealtimeDataTableProps> = ({
  data,
  loading,
  error,
  columns,
  onRetry,
  emptyMessage = 'No data available'
}) => {
  return (
    <DataLoadingState
      loading={loading}
      error={error}
      retryAction={onRetry}
      loadingComponent={
        <div className="w-full">
          <div className="animate-pulse">
            {/* Table header skeleton */}
            <div className="flex space-x-4 mb-4">
              {columns.map((_, index) => (
                <div key={index} className="flex-1 h-4 bg-gray-200 rounded" />
              ))}
            </div>
            {/* Table rows skeleton */}
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="flex space-x-4 mb-2">
                {columns.map((_, colIndex) => (
                  <div key={colIndex} className="flex-1 h-6 bg-gray-100 rounded" />
                ))}
              </div>
            ))}
          </div>
        </div>
      }
    >
      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">📭</div>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.map((item, index) => (
                <tr 
                  key={item.id || index}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {column.render 
                        ? column.render(item[column.key], item)
                        : item[column.key]
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataLoadingState>
  );
};

interface OptimisticUpdateIndicatorProps {
  isPending: boolean;
  className?: string;
}

export const OptimisticUpdateIndicator: React.FC<OptimisticUpdateIndicatorProps> = ({
  isPending,
  className = ''
}) => {
  if (!isPending) return null;

  return (
    <div className={`flex items-center space-x-2 text-blue-600 ${className}`}>
      <LoadingSpinner size="sm" />
      <span className="text-xs">Syncing...</span>
    </div>
  );
};

interface RealtimeStatusBadgeProps {
  lastUpdated: Date | null;
  className?: string;
}

export const RealtimeStatusBadge: React.FC<RealtimeStatusBadgeProps> = ({
  lastUpdated,
  className = ''
}) => {
  const getTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const isStale = lastUpdated && (Date.now() - lastUpdated.getTime()) > 5 * 60 * 1000; // 5 minutes

  return (
    <div className={`flex items-center space-x-2 text-xs ${className}`}>
      <div className={`w-2 h-2 rounded-full ${isStale ? 'bg-yellow-500' : 'bg-green-500'}`} />
      <span className="text-gray-600">
        Last updated: {getTimeAgo(lastUpdated)}
      </span>
    </div>
  );
};