import { useCallback } from 'react';

interface AppUpdateOptions {
  filePath: string;
  targetDirectory?: string;
  selectedApp?: string;
}

interface AppSwitchOptions {
  selectedApp?: string;
}

interface AppProgress {
  transferred?: number;
  total?: number;
  percentage: number;
  stage: 'uploading' | 'extracting' | 'restarting' | 'completed' | 'error';
  message: string;
}

interface AppSwitchProgress {
  transferred?: number;
  total?: number;
  percentage: number;
  stage: 'writing' | 'restarting' | 'completed' | 'error';
  message: string;
}

interface AppResult {
  success: boolean;
  error?: string;
}

export type { AppSwitchProgress };

export const useApp = () => {
  // 开始应用更新
  const updateApp = useCallback(
    async (options: AppUpdateOptions): Promise<AppResult> => {
      const result = await window.electron.ipcRenderer.invoke(
        'app:update',
        options,
      );
      return result;
    },
    [],
  );

  const switchApp = useCallback(
    async (options: AppSwitchOptions): Promise<AppResult> => {
      try {
        const result = await window.electron.ipcRenderer.invoke(
          'app:switch',
          options,
        );
        return result;
      } catch (error) {
        console.error('Failed to start app switch:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        };
      }
    },
    [],
  );

  // 监听更新进度
  const onUpdateProgress = useCallback(
    (callback: (progress: AppProgress) => void) => {
      const unsubscribe = window.electron.ipcRenderer.on(
        'app:update-progress',
        callback,
      );
      return unsubscribe;
    },
    [],
  );

  const onSwitchProgress = useCallback(
    (callback: (progress: AppSwitchProgress) => void) => {
      const unsubscribe = window.electron.ipcRenderer.on(
        'app:switch-progress',
        callback,
      );
      return unsubscribe;
    },
    [],
  );

  const getCurrentApp = useCallback(async () => {
    const result = await window.electron.ipcRenderer.invoke(
      'app:get-current-app',
    );
    return result;
  }, []);

  return {
    updateApp,
    switchApp,
    onUpdateProgress,
    onSwitchProgress,
    getCurrentApp,
  };
};

export default useApp;
