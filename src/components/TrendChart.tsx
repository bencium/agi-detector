'use client';

import React from 'react';

interface TrendData {
  timestamp: string;
  avgScore: number;
  maxScore: number;
  criticalAlerts: number;
}

interface TrendChartProps {
  data: TrendData[];
  period: 'daily' | 'weekly' | 'monthly';
}

export default function TrendChart({ data, period }: TrendChartProps) {
  if (!data || data.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-[var(--muted)]">
        Not enough history yet
      </div>
    );
  }

  const sortedData = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate chart dimensions
  const maxScore = sortedData.length > 0 
    ? Math.max(...sortedData.map(d => d.maxScore || 0)) 
    : 1;
  const chartHeight = 200;
  const chartWidth = 600;
  const padding = 40;

  // Generate SVG path for the trend line
  const generatePath = (scores: number[]) => {
    if (scores.length === 0) return '';
    if (scores.length === 1) {
      const x = chartWidth / 2;
      const y = chartHeight - padding - (scores[0] * (chartHeight - 2 * padding));
      return `M ${x},${y}`;
    }
    
    const points = scores.map((score, index) => {
      const x = padding + (index * (chartWidth - 2 * padding)) / (scores.length - 1);
      const y = chartHeight - padding - (score * (chartHeight - 2 * padding));
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  };

  const avgScorePath = generatePath(sortedData.map(d => d.avgScore || 0));
  const maxScorePath = generatePath(sortedData.map(d => d.maxScore || 0));
  const latestPoint = sortedData[sortedData.length - 1];

  return (
    <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)]">
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        AGI Risk Trend ({period})
      </h3>
      
      <div className="relative">
        <svg width={chartWidth} height={chartHeight} className="w-full h-auto">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((value) => {
            const y = chartHeight - padding - (value * (chartHeight - 2 * padding));
            return (
              <g key={value}>
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding - 10}
                  y={y + 5}
                  textAnchor="end"
                  className="text-xs fill-[var(--muted)]"
                >
                  {(value * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* Average score line */}
          <path
            d={avgScorePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />

          {/* Max score line */}
          <path
            d={maxScorePath}
            fill="none"
            stroke="var(--danger)"
            strokeWidth="1"
            strokeDasharray="4,4"
          />

          {/* Data points */}
          {sortedData.length > 0 && sortedData.map((point, index) => {
            const x = sortedData.length === 1 
              ? chartWidth / 2 
              : padding + (index * (chartWidth - 2 * padding)) / (sortedData.length - 1);
            const y = chartHeight - padding - ((point.avgScore || 0) * (chartHeight - 2 * padding));
            
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="var(--accent)"
                  className="hover:r-6 transition-all cursor-pointer"
                />
                {(point.criticalAlerts || 0) > 0 && (
                  <circle
                    cx={x}
                    cy={y}
                    r="8"
                    fill="none"
                    stroke="var(--danger)"
                    strokeWidth="2"
                    className="animate-pulse"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center space-x-6 mt-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--accent)]"></div>
            <span className="text-xs text-[var(--muted)]">Average Score</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--danger)] opacity-50"></div>
            <span className="text-xs text-[var(--muted)]">Max Score</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full border-2 border-[var(--danger)]"></div>
            <span className="text-xs text-[var(--muted)]">Critical Alert</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-[var(--border)]">
        <div>
          <div className="text-xs text-[var(--muted)]">Latest Score</div>
          <div className="text-lg font-semibold text-[var(--foreground)]">
            {latestPoint ? `${((latestPoint.avgScore || 0) * 100).toFixed(1)}%` : '0.0%'}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted)]">Peak Score</div>
          <div className="text-lg font-semibold text-[var(--danger)]">
            {sortedData.length > 0 ? `${(maxScore * 100).toFixed(1)}%` : '0.0%'}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted)]">Critical Alerts</div>
          <div className="text-lg font-semibold text-[var(--foreground)]">
            {sortedData.reduce((sum, d) => sum + (d.criticalAlerts || 0), 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
