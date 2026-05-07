import { BrowserWindow } from 'electron';
import { ErrorResponse, SuccessResponse } from '../util';
import { sshManager, windowManager } from '../managers';

class Window {
  window: BrowserWindow | null = null;

  private connectionId?: string;

  constructor(winId, connectionId?: string) {
    this.window = BrowserWindow.fromId(winId);
    this.connectionId = connectionId;
    this.window?.once('closed', () => {
      // 清理引用
      this.window = null;
    });
  }

  getCurrentInfo() {
    const { window } = this;
    if (!window) {
      return new ErrorResponse('窗口不存在或已关闭');
    }

    const info = {
      id: window.id,
      title: window.getTitle(),
      bounds: window.getBounds(),
      isMaximized: window.isMaximized(),
      isMinimized: window.isMinimized(),
      isFocused: window.isFocused(),
      authInfo: this.connectionId
        ? sshManager.getPublicCredentials(this.connectionId)
        : null,
    };
    return new SuccessResponse(info);
  }

  // eslint-disable-next-line class-methods-use-this
  createChildWindow(filePath, options, connectionId?: string) {
    const window = windowManager.createChildWindow(
      filePath,
      options,
      connectionId,
    );
    if (window) {
      return new SuccessResponse(null);
    }
    return new ErrorResponse('创建窗口失败');
  }

  closeWindow() {
    const { window } = this;
    if (!window) {
      return new SuccessResponse(null);
    }

    window.close();
    return new SuccessResponse(null);
  }
}

export default Window;
