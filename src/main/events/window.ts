import { BrowserWindow } from 'electron';
import { ErrorResponse, SuccessResponse } from '../util';
import { sshManager, windowManager } from '../managers';

class Window {
  window: BrowserWindow | null = null;

  constructor(winId) {
    this.window = BrowserWindow.fromId(winId);
    this.window?.once('closed', () => {
      // 清理引用
      this.window = null;
    });
  }

  getCurrentInfo() {
    const { window } = this;
    const info = {
      id: window.id,
      title: window.getTitle(),
      bounds: window.getBounds(),
      isMaximized: window.isMaximized(),
      isMinimized: window.isMinimized(),
      isFocused: window.isFocused(),
      authInfo: sshManager.sshCredentials,
    };
    return new SuccessResponse(info);
  }

  // eslint-disable-next-line class-methods-use-this
  createChildWindow(filePath, options) {
    const window = windowManager.createChildWindow(filePath, options);
    if (window) {
      return new SuccessResponse(null);
    }
    return new ErrorResponse('创建窗口失败');
  }
}

export default Window;
