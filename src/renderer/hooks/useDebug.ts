import { useCallback } from 'react';

export const useDebug = () => {
  const debugConnect = useCallback((formValues) => {
    return window.electron.ipcRenderer.invoke('debug:connect', formValues);
  }, []);

  const debugDisconnect = useCallback((formValues?) => {
    return window.electron.ipcRenderer.invoke('debug:disconnect', formValues);
  }, []);

  const getDebugTargets = useCallback(() => {
    return window.electron.ipcRenderer.invoke('debug:get-targets');
  }, []);

  return {
    debugConnect,
    debugDisconnect,
    getDebugTargets,
  };
};

export default useDebug;
