import React from 'react';
import { Activity } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading real-time warehouse telemetry..."
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center space-y-3">
      <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shadow-xs">
        <Activity className="w-5 h-5 text-blue-600 animate-spin" />
      </div>
      <p className="text-xs font-medium text-slate-500 animate-pulse">{message}</p>
    </div>
  );
};

