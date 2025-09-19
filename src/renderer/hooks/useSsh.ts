import { useCallback } from 'react';

export const useSSH = () => {
  const authenticate = useCallback(async (credentials) => {
    try {
      return await window.electron.ipcRenderer.invoke(
        'ssh:authenticate',
        credentials,
      );
    } catch (error) {
      console.error('Failed to authenticate SSH:', error);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      return await window.electron.ipcRenderer.invoke('ssh:disconnect');
    } catch (error) {
      console.error('Failed to disconnect SSH:', error);
    }
  }, []);

  return {
    authenticate,
    disconnect,
  };
};

export default useSSH;
