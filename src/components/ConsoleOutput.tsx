'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ConsoleOutputProps {
  logs: string[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export default function ConsoleOutput({ logs, isExpanded, onToggleExpand }: ConsoleOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Collapsed to just header bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg w-[200px]">
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[var(--surface-hover)] rounded-lg"
          onClick={() => setIsMinimized(false)}
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-[var(--foreground)]">Console</span>
            {logs.length > 0 && (
              <span className="text-[10px] text-[var(--muted)]">({logs.length})</span>
            )}
          </div>
          <svg className="w-3 h-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg transition-all ${
      isExpanded ? 'w-[600px] h-[400px]' : 'w-[300px] h-[150px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-[var(--foreground)]">Console Output</span>
        </div>
        <div className="flex items-center space-x-1">
          {/* Minimize to bar */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-[var(--surface-hover)] rounded transition-colors"
            title="Minimize to bar"
          >
            <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {/* Expand/Shrink */}
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-[var(--surface-hover)] rounded transition-colors"
            title={isExpanded ? "Shrink" : "Expand"}
          >
            <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Console Content */}
      <div 
        ref={scrollRef}
        className="p-2 overflow-y-auto text-xs font-mono"
        style={{ height: isExpanded ? 'calc(100% - 36px)' : 'calc(100% - 36px)' }}
      >
        {logs.length === 0 ? (
          <div className="text-[var(--muted)]">Waiting for activity...</div>
        ) : (
          logs.map((log, index) => {
            const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('failed');
            const isSuccess = log.toLowerCase().includes('success') || log.toLowerCase().includes('found');
            const isWarning = log.toLowerCase().includes('warning') || log.toLowerCase().includes('retry');
            
            return (
              <div 
                key={index} 
                className={`py-0.5 ${
                  isError ? 'text-red-500' : 
                  isSuccess ? 'text-green-500' : 
                  isWarning ? 'text-yellow-500' : 
                  'text-[var(--muted)]'
                }`}
              >
                <span className="text-[var(--muted)] opacity-50">[{new Date().toLocaleTimeString()}]</span>{' '}
                {log}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}