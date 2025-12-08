import { BrowserWindow, dialog, OpenDialogOptions } from 'electron';
import { error } from 'electron-log';
import { ErrorResponse, SuccessResponse } from '../util';

class FileManager {
  window: BrowserWindow | null = null;

  constructor(windowId: number) {
    this.window = BrowserWindow.fromId(windowId);
    this.window?.once('closed', () => {
      // 清理引用
      this.window = null;
    });
  }

  async showOpenDialog(options: OpenDialogOptions) {
    try {
      const result = await dialog.showOpenDialog(this.window, options);

      if (result.canceled) {
        return new ErrorResponse('用户取消选择');
      }

      return new SuccessResponse({ filePath: result.filePaths[0] });
    } catch (err) {
      error('文件选择对话框错误:', err);
      return new ErrorResponse(err instanceof Error ? err.message : '未知错误');
    }
  }
}

export default FileManager;
