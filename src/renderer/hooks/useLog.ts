import { useCallback } from 'react';

interface ILogOptions {
  fileName: string;
  requestId: string;
  filters: {
    searchTerm: string;
    caseSensitive: boolean;
  };
}

export const useLog = () => {
  const getRealtimeLogFile = useCallback(async () => {
    try {
      return await window.electron.ipcRenderer.invoke(
        'log:get-stream-realtime-file',
      );
    } catch (error) {
      console.error('Failed to get realtime log:', error);
      return null;
    }
  }, []);

  const getHistoryLogList = useCallback(async () => {
    try {
      return await window.electron.ipcRenderer.invoke('log:get-history-list');
    } catch (error) {
      console.error('Failed to get log list:', error);
      return [];
    }
  }, []);

  const getRealtimeLog = useCallback(async (options: ILogOptions) => {
    try {
      return await window.electron.ipcRenderer.invoke(
        'log:get-stream-realtime',
        options,
      );
    } catch (error) {
      console.error('Failed to get realtime logs:', error);
      return null;
    }
  }, []);

  const getHistoryLog = useCallback(async (options: ILogOptions) => {
    try {
      return await window.electron.ipcRenderer.invoke(
        'log:get-stream-history',
        options,
      );
    } catch (error) {
      console.error('Failed to get history logs:', error);
      return null;
    }
  }, []);

  const clearStream = useCallback(async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('log:clear-stream', id);
    } catch (error) {
      console.error('Failed to clear stream:', error);
    }
  }, []);

  return {
    getRealtimeLogFile,
    getHistoryLogList,
    getRealtimeLog,
    getHistoryLog,
    clearStream,
  };
};

export default useLog;
