import { useCallback } from 'react';

export const useSystem = () => {
  const getStorageInfo = useCallback(() => {
    return window.electron.ipcRenderer.invoke('system:getStorageInfo');
  }, []);

  const systemReboot = useCallback(() => {
    return window.electron.ipcRenderer.invoke('system:reboot');
  }, []);

  const systemShutdown = useCallback(() => {
    return window.electron.ipcRenderer.invoke('system:shutdown');
  }, []);

  return {
    getStorageInfo,
    systemReboot,
    systemShutdown,
  };
};
