import { BrowserWindow, dialog } from 'electron';
import { info } from 'electron-log';
import { sshManager } from '../managers';
import { ErrorResponse, SuccessResponse } from '../util';

class System {
  window: BrowserWindow | null = null;
  constructor(windowId: number) {
    this.window = BrowserWindow.fromId(windowId);
    this.window?.once('closed', () => {
      // 清理引用
      this.window = null;
    });
  }
  async reboot() {
    try {
      await sshManager.executeCommand('sudo reboot');
      return new SuccessResponse(null);
    } catch (error) {
      console.error('执行重启命令失败:', error);
      return new ErrorResponse('重启失败');
    }
  }

  async rebootWithConfirmation(): Promise<
    SuccessResponse<void> | ErrorResponse
  > {
    const window = this.window;

    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      title: '系统重启确认',
      message: '您确定要重启系统吗？',
      detail: '系统重启后，所有未保存的工作将丢失，SSH连接也会断开。',
      buttons: ['取消', '确认重启'],
      defaultId: 0,
      cancelId: 0,
    });

    if (result.response === 1) {
      info('用户确认系统重启，正在执行重启命令');
      return await this.reboot();
    }

    return new ErrorResponse('用户取消重启操作');
  }
}

export default System;
