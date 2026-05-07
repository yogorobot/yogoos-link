import { useCallback } from 'react';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface AppUpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  progress?: number;
  error?: string;
  isTestingChannel: boolean;
}

export const useAutoUpdate = () => {
  const getUpdateState = useCallback(() => {
    return window.electron.ipcRenderer.invoke('update:get-state');
  }, []);

  const checkForUpdates = useCallback(() => {
    return window.electron.ipcRenderer.invoke('update:check');
  }, []);

  const downloadUpdate = useCallback(() => {
    return window.electron.ipcRenderer.invoke('update:download');
  }, []);

  const installUpdate = useCallback(() => {
    return window.electron.ipcRenderer.invoke('update:install');
  }, []);

  return {
    getUpdateState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  };
};

export default useAutoUpdate;
