/**
 * Skeleton Loading Component
 * Shimmer effect for better perceived performance
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'card' | 'text' | 'chart' | 'badge';
}

export function Skeleton({ className = '', variant = 'card' }: SkeletonProps) {
  const baseClasses = 'animate-shimmer bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] rounded';

  const variantClasses = {
    card: 'h-32 w-full',
    text: 'h-4 w-3/4',
    chart: 'h-64 w-full',
    badge: 'h-6 w-24 rounded-full'
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      role="status"
      aria-label="Loading..."
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="border border-gray-800 p-6 rounded-lg">
      <Skeleton variant="text" className="mb-2 w-1/2" />
      <Skeleton variant="text" className="h-8 w-1/3 mt-4" />
      <Skeleton variant="text" className="h-3 w-1/4 mt-2" />
    </div>
  );
}

export function SkeletonSourceCard() {
  return (
    <div className="border border-gray-800 p-4 rounded-lg border-l-4">
      <div className="flex items-center justify-between mb-2">
        <Skeleton variant="text" className="w-1/3" />
        <Skeleton variant="badge" />
      </div>
      <Skeleton variant="text" className="w-1/2 h-3" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="border border-gray-800 p-6 rounded-lg">
      <Skeleton variant="text" className="mb-4 w-1/4" />
      <Skeleton variant="chart" />
    </div>
  );
}
