import { BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import { info, error } from 'electron-log';
import Logs from '../core/log';
import Debug from '../core/debug';
import { SSHCredentials } from '../managers/ssh';
import { sshManager, windowManager } from '../managers';
import { decodeBase64, ErrorResponse, SuccessResponse } from '../util';
import AppUpdater, { IAppUpdateOptions } from '../core/app-update';
import AppSwitcher, { IAppSwitcherOptions } from '../core/switch-app';
import Package from '../core/package';
import System from '../core/system';

class IPCEvents {
  constructor() {
    this.registerLogEvents();
    this.registerSSHEvents();
    this.registerWindowEvents();
    this.registerDebugEvents();
    this.registerFileEvents();
    this.registerAppEvents();
    this.registerNotificationEvents();
    this.registerSystemEvents();
    this.registerPackageEvents();
  }

  registerPackageEvents() {
    ipcMain.handle('package:query', async () => {
      const packageInstance = new Package();
      return await packageInstance.queryPackages();
    });

    ipcMain.handle('package:clear', async (event, options) => {
      const packageInstance = new Package();
      return await packageInstance.clearPackages();
    });
  }

  registerSystemEvents() {
    ipcMain.handle('system:reboot', async (event) => {
      const systemInstance = new System();
      try {
        info('系统重启请求');

        // 获取当前窗口
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          return new ErrorResponse('无法获取当前窗口');
        }

        // 显示确认对话框
        const result = await dialog.showMessageBox(window, {
          type: 'warning',
          title: '系统重启确认',
          message: '您确定要重启系统吗？',
          detail: '系统重启后，所有未保存的工作将丢失，SSH连接也会断开。',
          buttons: ['取消', '确认重启'],
          defaultId: 0,
          cancelId: 0,
        });

        // 用户取消操作
        if (result.response === 0) {
          info('用户取消系统重启操作');
          return new ErrorResponse('用户取消操作');
        }

        // 用户确认重启
        info('用户确认系统重启，正在执行重启命令');
        await systemInstance.reboot();
        return new SuccessResponse(null);
      } catch (err) {
        error('系统重启失败:', err);
        return new ErrorResponse(
          err instanceof Error ? err.message : '未知错误',
        );
      }
    });
  }

  registerLogEvents() {
    let logInstance: Logs = null;
    ipcMain.handle('log:get-history-list', async (event) => {
      logInstance = new Logs(event.sender.id);
      const logs = await logInstance.getHistoryLogList();
      return logs;
    });

    ipcMain.handle('log:get-stream-realtime-file', async (event) => {
      logInstance = new Logs(event.sender.id);
      return await logInstance.getStreamRealtimeFile();
    });

    ipcMain.handle('log:get-stream-realtime', async (event, options) => {
      const windowId = event.sender.id;
      logInstance = new Logs(windowId);
      return await logInstance.getStreamRealtime(options);
    });
    ipcMain.handle('log:get-stream-history', async (event, options) => {
      const windowId = event.sender.id;
      logInstance = new Logs(windowId);
      return await logInstance.getStreamHistory(options);
    });

    ipcMain.handle('log:clear-stream', async (event, id) => {
      await logInstance.clearup();
    });
  }

  registerSSHEvents() {
    // SSH认证
    ipcMain.handle(
      'ssh:authenticate',
      async (event, credentials: SSHCredentials) => {
        const result = await sshManager.authenticateSSH(credentials);

        if (result.success) {
          windowManager.createMainWindow();
        }

        return result;
      },
    );

    // 断开SSH连接
    ipcMain.handle('ssh:disconnect', async (event) => {
      windowManager.createLoginWindow();
    });
  }

  registerWindowEvents() {
    ipcMain.handle(
      'window:set-size',
      async (event, { width, height, center = false }) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        const display = windowManager.getDisplay();

        if (!window) return null;

        // 获取标题栏高度
        const bounds = window.getBounds();
        const contentBounds = window.getContentBounds();
        const titleBarHeight = bounds.height - contentBounds.height;

        console.log(`=== 动态调整窗口大小 ===`);
        console.log(`请求尺寸: ${width}x${height}`);
        console.log(`是否居中: ${center}`);
        // console.log(`是否首次居中: ${!window._hasBeenCentered}`);
        console.log(`标题栏高度: ${titleBarHeight}`);
        console.log(`屏幕边界:`, display.bounds);

        const w = Math.min(display.bounds.width, width);
        const h = Math.min(display.bounds.height, height + titleBarHeight);

        // 判断是否需要居中：明确要求居中 或者 窗口从未被居中过
        // const shouldCenter = center || !window._hasBeenCentered;

        if (true) {
          // 计算居中位置
          const centerX =
            display.bounds.x + Math.floor((display.bounds.width - w) / 2);
          const centerY =
            display.bounds.y + Math.floor((display.bounds.height - h) / 2);

          console.log(`调整后尺寸: ${w}x${h}`);
          console.log(`居中位置: (${centerX}, ${centerY})`);

          // 同时设置尺寸和位置，确保窗口居中
          window.setBounds({
            x: centerX,
            y: centerY,
            width: w,
            height: h,
          });

          // 标记窗口已经被居中过
          // window._hasBeenCentered = true;
        } else {
          // 只调整尺寸，保持当前位置
          console.log(`调整后尺寸: ${w}x${h}`);
          console.log(`保持当前位置: (${bounds.x}, ${bounds.y})`);

          window.setSize(w, h);
        }
      },
    );

    // 获取当前窗口的信息
    ipcMain.handle('window:get-current-info', (event) => {
      const window = BrowserWindow.fromWebContents(event.sender) as any;
      if (!window) return null;

      return {
        id: window.id,
        title: window.getTitle(),
        bounds: window.getBounds(),
        isMaximized: window.isMaximized(),
        isMinimized: window.isMinimized(),
        isFocused: window.isFocused(),
        authInfo: window.authInfo ? decodeBase64(window.authInfo) : undefined,
      };
    });

    ipcMain.handle('window:minimize', (event, windowId) => {
      const targetWindow = windowId
        ? BrowserWindow.fromId(windowId)
        : BrowserWindow.fromWebContents(event.sender);
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.minimize();
        return new SuccessResponse(null);
      }
      return new ErrorResponse('Window not found');
    });

    ipcMain.handle('window:close', (event, windowId) => {
      const targetWindow = windowId
        ? BrowserWindow.fromId(windowId)
        : BrowserWindow.fromWebContents(event.sender);
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.close();
        return new SuccessResponse(null);
      }
      return new ErrorResponse('Window not found');
    });

    ipcMain.handle('window:toggle-maximize', (event, windowId) => {
      const targetWindow = windowId
        ? BrowserWindow.fromId(windowId)
        : BrowserWindow.fromWebContents(event.sender);
      if (targetWindow && !targetWindow.isDestroyed()) {
        if (targetWindow.isMaximized()) {
          targetWindow.unmaximize();
        } else {
          targetWindow.maximize();
        }
        return new SuccessResponse({ isMaximized: targetWindow.isMaximized() });
      }
      return new ErrorResponse('Window not found');
    });

    ipcMain.handle('window:maximize', (event, windowId) => {
      const targetWindow = windowId
        ? BrowserWindow.fromId(windowId)
        : BrowserWindow.fromWebContents(event.sender);
      if (targetWindow && !targetWindow.isDestroyed()) {
        if (targetWindow.isMaximized()) {
          targetWindow.unmaximize();
        } else {
          targetWindow.maximize();
        }
        return new SuccessResponse(null);
      }
      return new ErrorResponse('Window not found');
    });

    ipcMain.handle('window:toggle-size', (event) => {
      const targetWindow = BrowserWindow.fromWebContents(event.sender);
      if (targetWindow && !targetWindow.isDestroyed()) {
        // 获取屏幕信息
        const display = windowManager.getDisplay();

        // 检查窗口是否可调整大小
        const isResizable = targetWindow.isResizable();

        if (!isResizable) {
          // 对于不可调整大小的窗口（如登录窗口），只进行居中操作
          const currentBounds = targetWindow.getBounds();

          console.log(`=== 登录窗口居中调试信息 ===`);
          console.log(`屏幕信息:`, {
            x: display.bounds.x,
            y: display.bounds.y,
            width: display.bounds.width,
            height: display.bounds.height,
          });
          console.log(`当前窗口边界:`, currentBounds);

          // 计算居中位置
          const centerX =
            display.bounds.x +
            Math.floor((display.bounds.width - currentBounds.width) / 2);
          const centerY =
            display.bounds.y +
            Math.floor((display.bounds.height - currentBounds.height) / 2);

          console.log(`计算的居中位置: x=${centerX}, y=${centerY}`);

          // 确保坐标不会是负数或超出屏幕边界
          const safeX = Math.max(
            display.bounds.x,
            Math.min(
              centerX,
              display.bounds.x + display.bounds.width - currentBounds.width,
            ),
          );
          const safeY = Math.max(
            display.bounds.y,
            Math.min(
              centerY,
              display.bounds.y + display.bounds.height - currentBounds.height,
            ),
          );

          console.log(`安全坐标: x=${safeX}, y=${safeY}`);

          targetWindow.setPosition(safeX, safeY);
        } else {
          // 对于可调整大小的窗口，进行最大化/恢复操作
          if (targetWindow.isMaximized()) {
            // 恢复到默认尺寸并居中
            targetWindow.unmaximize();
            const defaultSize = { width: 1200, height: 800 };
            const x =
              display.bounds.x +
              Math.floor((display.bounds.width - defaultSize.width) / 2);
            const y =
              display.bounds.y +
              Math.floor((display.bounds.height - defaultSize.height) / 2);
            targetWindow.setBounds({
              x,
              y,
              width: defaultSize.width,
              height: defaultSize.height,
            });
          } else {
            // 最大化窗口
            targetWindow.maximize();
          }
        }

        return new SuccessResponse(null);
      }
      return new ErrorResponse('Window not found');
    });

    ipcMain.handle('window:create', async (event, filePath, options) => {
      const window = await windowManager.createChildWindow(filePath, options);
      if (window) {
        return new SuccessResponse(null);
      }

      return new ErrorResponse('Failed to create window');
    });
  }

  registerFileEvents() {
    // 文件选择对话框
    ipcMain.handle('file:show-open-dialog', async (event, options) => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showOpenDialog(window, {
          title: '选择SSH私钥文件',
          defaultPath: '~/.ssh',
          properties: ['openFile', 'showHiddenFiles'],
          ...options,
        });

        if (result.canceled) {
          return new ErrorResponse('用户取消选择');
        }

        return new SuccessResponse({ filePath: result.filePaths[0] });
      } catch (err) {
        error('文件选择对话框错误:', err);
        return new ErrorResponse(
          err instanceof Error ? err.message : '未知错误',
        );
      }
    });
  }

  registerDebugEvents() {
    let debugInstance: Debug = null;
    ipcMain.handle('debug:connect', async (event, formValues) => {
      debugInstance = new Debug(event.sender.id);
      try {
        const result = await debugInstance?.connect(formValues);
        return result;
      } catch (err) {
        error('调试连接失败:', err);

        // 确保错误对象能够正确序列化
        if (err && typeof err === 'object' && err.success === false) {
          // 如果是 ErrorResponse 对象，直接返回
          return new ErrorResponse(err.error || '调试连接失败');
        }

        // 其他类型的错误
        return new ErrorResponse(
          err instanceof Error ? err.message : '调试连接失败',
        );
      }
    });

    ipcMain.handle('debug:disconnect', async () => {
      try {
        const result = await debugInstance?.disconnect();
        return result;
      } catch (err) {
        error('断开调试连接失败:', err);

        // 确保错误对象能够正确序列化
        if (err && typeof err === 'object' && err.success === false) {
          return new ErrorResponse(err.error || '断开调试连接失败');
        }

        return new ErrorResponse(
          err instanceof Error ? err.message : '断开调试连接失败',
        );
      }
    });
  }

  registerAppEvents() {
    // 应用更新开始
    ipcMain.handle('app:update', async (event, options: IAppUpdateOptions) => {
      try {
        const updater = new AppUpdater(options, event.sender.id);
        await updater.performUpdate();

        return new SuccessResponse(null);
      } catch (err) {
        error('应用更新失败:', err);
        return new ErrorResponse(
          err instanceof Error ? err.message : '未知错误',
        );
      }
    });

    ipcMain.handle(
      'app:switch',
      async (event, options: IAppSwitcherOptions) => {
        try {
          const switcher = new AppSwitcher(options, event.sender.id);
          await switcher.switchApp();

          return new SuccessResponse(null);
        } catch (err) {
          error('应用切换失败:', err);
          return new ErrorResponse(
            err instanceof Error ? err.message : '未知错误',
          );
        }
      },
    );

    ipcMain.handle(
      'app:get-current-app',
      async (event, options: IAppSwitcherOptions) => {
        try {
          const switcher = new AppSwitcher(options, event.sender.id);
          const currentApp = await switcher.getCurrentApp();

          return new SuccessResponse({ currentApp });
        } catch (err) {
          error('获取当前应用失败:', err);
          return new ErrorResponse(
            err instanceof Error ? err.message : '未知错误',
          );
        }
      },
    );
  }

  registerNotificationEvents() {
    // 显示系统通知
    ipcMain.handle('notification:show', async (event, options) => {
      try {
        const { title, body, type = 'info', silent = false } = options;

        // 检查系统是否支持通知
        if (!Notification.isSupported()) {
          return new ErrorResponse('系统不支持通知功能');
        }

        const notification = new Notification({
          title: title || 'SSH Inspector',
          body,
          silent,
          icon: undefined, // 可以根据需要设置应用图标路径
        });

        // 显示通知
        notification.show();

        info('系统通知已显示:', { title, body, type });

        return new SuccessResponse(null);
      } catch (err) {
        error('显示系统通知失败:', err);
        return new ErrorResponse(
          err instanceof Error ? err.message : '未知错误',
        );
      }
    });

    // 检查通知权限
    ipcMain.handle('notification:check-permission', async () => {
      try {
        return new SuccessResponse({
          supported: Notification.isSupported(),
        });
      } catch (err) {
        return new ErrorResponse(
          err instanceof Error ? err.message : '未知错误',
        );
      }
    });
  }
}

export default IPCEvents;
