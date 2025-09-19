import { useCallback } from 'react';

interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: string[];
}

interface SaveTempFileData {
  fileName: string;
  data: number[];
}

interface FileDialogResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

interface SaveTempResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export const useFile = () => {
  // 显示文件选择对话框
  const showOpenDialog = useCallback(
    async (options?: OpenDialogOptions): Promise<FileDialogResult> => {
      try {
        const result = await window.electron.ipcRenderer.invoke(
          'file:show-open-dialog',
          options,
        );
        return result;
      } catch (error) {
        console.error('Failed to show open dialog:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        };
      }
    },
    [],
  );

  return {
    showOpenDialog,
  };
};

export default useFile;
