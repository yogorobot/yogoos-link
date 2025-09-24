export const useSystem = () => {
  const systemReboot = () => {
    return window.electron.ipcRenderer.invoke('system:reboot');
  };

  const systemShutdown = () => {
    return window.electron.ipcRenderer.invoke('system:shutdown');
  };

  return {
    systemReboot,
    systemShutdown,
  };
};
