export const usePackage = () => {
  const packageQuery = () => {
    return window.electron.ipcRenderer.invoke('package:query');
  };

  const packageClear = () => {
    return window.electron.ipcRenderer.invoke('package:clear');
  };

  return {
    packageQuery,
    packageClear,
  };
};
