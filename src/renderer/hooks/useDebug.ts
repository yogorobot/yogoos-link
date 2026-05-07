export const useDebug = () => {
  const debugConnect = (formValues) => {
    return window.electron.ipcRenderer.invoke('debug:connect', formValues);
  };

  const debugDisconnect = (formValues) => {
    return window.electron.ipcRenderer.invoke('debug:disconnect', formValues);
  };

  const getDebugTargets = () => {
    return window.electron.ipcRenderer.invoke('debug:get-targets');
  };

  return {
    debugConnect,
    debugDisconnect,
    getDebugTargets,
  };
};

export default useDebug;
