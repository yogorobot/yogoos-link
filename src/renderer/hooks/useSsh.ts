import { useCallback } from 'react';

export const useSSH = () => {
  const authenticate = useCallback(
    async (credentials, connectionId?: string) => {
      try {
        return await window.electron.ipcRenderer.invoke(
          'ssh:authenticate',
          credentials,
          connectionId,
        );
      } catch (error) {
        console.error('Failed to authenticate SSH:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '连接失败',
        };
      }
    },
    [],
  );

  const cancelAuthentication = useCallback(async (connectionId: string) => {
    try {
      return await window.electron.ipcRenderer.invoke(
        'ssh:cancel-authentication',
        connectionId,
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '取消连接失败',
      };
    }
  }, []);

  const disconnect = useCallback(async (connectionId: string) => {
    try {
      return await window.electron.ipcRenderer.invoke(
        'ssh:disconnect-by-id',
        connectionId,
      );
    } catch (error) {
      console.error('Failed to disconnect SSH:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '断开连接失败',
      };
    }
  }, []);

  return {
    authenticate,
    cancelAuthentication,
    disconnect,
  };
};

export default useSSH;
