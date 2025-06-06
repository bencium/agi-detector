import { useEffect, useState, useCallback } from 'react';

export function useConsoleCapture(maxLogs: number = 100) {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLogs(prev => {
      const newLogs = [...prev, message];
      // Keep only the last maxLogs entries
      return newLogs.slice(-maxLogs);
    });
  }, [maxLogs]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    // Override console methods
    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLog(message);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      const message = `ERROR: ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`;
      addLog(message);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      const message = `WARNING: ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`;
      addLog(message);
      originalWarn.apply(console, args);
    };

    console.info = (...args) => {
      const message = `INFO: ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}`;
      addLog(message);
      originalInfo.apply(console, args);
    };

    // Cleanup function to restore original console methods
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    };
  }, [addLog]);

  return { logs, addLog, clearLogs };
}