export const useDebug = () => {
  const debugConnect = (formValues) => {
    return window.electron.ipcRenderer.invoke('debug:connect', formValues);
  };

  const debugDisconnect = (formValues) => {
    return window.electron.ipcRenderer.invoke('debug:disconnect', formValues);
  };

  return {
    debugConnect,
    debugDisconnect,
  };
};
