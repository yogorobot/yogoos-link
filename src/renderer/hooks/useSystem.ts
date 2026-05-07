import { useCallback } from 'react';

export const useSystem = () => {
  const getStorageInfo = useCallback(() => {
    return window.electron.ipcRenderer.invoke('system:getStorageInfo');
  }, []);

  const systemReboot = useCallback((connectionId?: string) => {
    return window.electron.ipcRenderer.invoke('system:reboot', connectionId);
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

export default useSystem;
