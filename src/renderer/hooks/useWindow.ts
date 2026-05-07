import { BrowserWindowConstructorOptions } from 'electron';
import { useCallback } from 'react';

export const useWindow = () => {
  // 设置窗口大小，可选择是否居中显示
  // center参数：true=强制居中，false=保持当前位置，undefined=仅首次居中
  const setWindowSize = useCallback(
    async (width: number, height: number, center?: boolean) => {
      try {
        await window.electron.ipcRenderer.invoke('window:set-size', {
          width,
          height,
          center,
        });
      } catch (error) {
        console.error('Failed to set window size:', error);
      }
    },
    [],
  );

  // 获取当前窗口信息
  const getCurrentWindowInfo = useCallback(async () => {
    try {
      const info = await window.electron.ipcRenderer.invoke(
        'window:get-current-info',
      );
      return info;
    } catch (error) {
      console.error('Failed to get current window info:', error);
      return null;
    }
  }, []);

  const minimizeWindow = useCallback(async (windowId?: number) => {
    try {
      return await window.electron.ipcRenderer.invoke(
        'window:minimize',
        windowId,
      );
    } catch (error) {
      console.error('Failed to minimize window:', error);
      return { success: false, error: 'Failed to minimize window' };
    }
  }, []);

  const maximizeWindow = useCallback(async (windowId?: number) => {
    try {
      return await window.electron.ipcRenderer.invoke(
        'window:maximize',
        windowId,
      );
    } catch (error) {
      console.error('Failed to maximize window:', error);
      return { success: false, error: 'Failed to maximize window' };
    }
  }, []);

  const toggleWindowSize = useCallback(async () => {
    try {
      return await window.electron.ipcRenderer.invoke('window:toggle-size');
    } catch (error) {
      console.error('Failed to toggle window size:', error);
      return { success: false, error: 'Failed to toggle window size' };
    }
  }, []);

  const toggleMaximize = useCallback(async (windowId?: number) => {
    try {
      return await window.electron.ipcRenderer.invoke(
        'window:toggle-maximize',
        windowId,
      );
    } catch (error) {
      console.error('Failed to toggle maximize window:', error);
      return { success: false, error: 'Failed to toggle maximize window' };
    }
  }, []);

  const closeWindow = useCallback(async (windowId?: number) => {
    try {
      return await window.electron.ipcRenderer.invoke('window:close', windowId);
    } catch (error) {
      console.error('Failed to close window:', error);
      return { success: false, error: 'Failed to close window' };
    }
  }, []);

  const createWindow = useCallback(
    async (
      filePath: string,
      options?: BrowserWindowConstructorOptions,
      connectionId?: string,
    ) => {
      try {
        return await window.electron.ipcRenderer.invoke(
          'window:create',
          filePath,
          options,
          connectionId,
        );
      } catch (error) {
        console.error('Failed to create window:', error);
        return { success: false, error: 'Failed to create window' };
      }
    },
    [],
  );

  return {
    getCurrentWindowInfo,
    setWindowSize,
    minimizeWindow,
    maximizeWindow,
    toggleMaximize,
    closeWindow,
    toggleWindowSize,
    createWindow,
  };
};

export default useWindow;
