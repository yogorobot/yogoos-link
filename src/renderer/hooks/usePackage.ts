export const usePackage = () => {
  const packageQuery = () => {
    return window.electron.ipcRenderer.invoke('package:query');
  };

  const packageClear = () => {
    return window.electron.ipcRenderer.invoke('package:clear');
  };

  const packageClearSingle = (packageId: number) => {
    return window.electron.ipcRenderer.invoke(
      'package:clear-single',
      packageId,
    );
  };

  return {
    packageQuery,
    packageClear,
    packageClearSingle,
  };
};
