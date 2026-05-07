import { useCallback } from 'react';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'error';

export interface AppUpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  releaseUrl?: string;
  error?: string;
  hasRequiredAssets?: boolean;
  isTestingChannel: boolean;
}

export const useAutoUpdate = () => {
  const getUpdateState = useCallback(() => {
    return window.electron.ipcRenderer.invoke('update:get-state');
  }, []);

  const checkForUpdates = useCallback(() => {
    return window.electron.ipcRenderer.invoke('update:check');
  }, []);

  const openDownloadPage = useCallback(() => {
    return window.electron.ipcRenderer.invoke('update:open-download-page');
  }, []);

  return {
    getUpdateState,
    checkForUpdates,
    openDownloadPage,
  };
};

export default useAutoUpdate;
