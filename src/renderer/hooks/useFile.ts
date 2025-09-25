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

interface SaveTempResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export const useFile = () => {
  // 显示文件选择对话框
  const showOpenDialog = useCallback(
    async (options?: OpenDialogOptions): Promise<any> => {
      const result = await window.electron.ipcRenderer.invoke(
        'file:show-open-dialog',
        options,
      );
      console.log(result);
      return result;
    },
    [],
  );

  return {
    showOpenDialog,
  };
};

export default useFile;
