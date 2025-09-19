import { BrowserWindow, ipcMain, dialog, Notification } from "electron";
import { info, error } from "electron-log";
import log from "../core/log";
import debug from "../core/debug";
import { SSHCredentials } from "../managers/ssh";
import { sshManager, windowManager } from "../managers";
import { decodeBase64 } from "../util";
import AppUpdater, { IAppUpdateOptions } from "../core/app-update";
import AppSwitcher, { IAppSwitcherOptions } from "../core/switch-app";

class IPCEvents {
  constructor() {
    this.registerLogEvents();
    this.registerSSHEvents();
    this.registerWindowEvents();
    this.registerDebugEvents();
    this.registerFileEvents();
    this.registerAppEvents();
    this.registerNotificationEvents();
  }

  registerLogEvents() {
    ipcMain.handle("log:get-history-list", async (event) => {
      const logs = await log.getHistoryLogList();
      return logs;
    });

    ipcMain.handle("log:get-stream-realtime-file", async (event) => {
      return await log.getStreamRealtimeFile();
    });

    ipcMain.handle("log:get-stream-realtime", async (event, options) => {
      const windowId = event.sender.id;
      return await log.getStreamRealtime(windowId, options);
    });
    ipcMain.handle("log:get-stream-history", async (event, options) => {
      const windowId = event.sender.id;
      return await log.getStreamHistory(windowId, options);
    });

    ipcMain.handle("log:clear-stream", async (event, id) => {
      info("清理日志流:", id);
      await log.clearStream(id);
    });
  }

  registerSSHEvents() {
    // SSH认证
    ipcMain.handle(
      "ssh:authenticate",
      async (event, credentials: SSHCredentials) => {
        try {
          info("SSH认证请求:", {
            host: credentials.host,
            username: credentials.username,
          });

          const result = await sshManager.authenticateSSH(credentials);

          if (result.success) {
            // 认证成功，创建主窗口并传递认证信息
            windowManager.createMainWindow({
              title: "",
            });
          }

          return result;
        } catch (err) {
          error("SSH认证错误:", err);
          return {
            success: false,
            error: err instanceof Error ? err.message : "未知错误",
          };
        }
      },
    );

    // 断开SSH连接
    ipcMain.handle("ssh:disconnect", async (event) => {
      windowManager.createLoginWindow();
    });
  }

  registerWindowEvents() {
    ipcMain.handle(
      "window:set-size",
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
    ipcMain.handle("window:get-current-info", (event) => {
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

    ipcMain.handle("window:minimize", (event, windowId) => {
      const targetWindow = windowId
        ? BrowserWindow.fromId(windowId)
        : BrowserWindow.fromWebContents(event.sender);
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.minimize();
        return { success: true };
      }
      return { success: false, error: "Window not found" };
    });

    ipcMain.handle("window:close", (event, windowId) => {
      const targetWindow = windowId
        ? BrowserWindow.fromId(windowId)
        : BrowserWindow.fromWebContents(event.sender);
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.close();
        return { success: true };
      }
      return { success: false, error: "Window not found" };
    });

    ipcMain.handle("window:toggle-maximize", (event, windowId) => {
      const targetWindow = windowId
        ? BrowserWindow.fromId(windowId)
        : BrowserWindow.fromWebContents(event.sender);
      if (targetWindow && !targetWindow.isDestroyed()) {
        if (targetWindow.isMaximized()) {
          targetWindow.unmaximize();
        } else {
          targetWindow.maximize();
        }
        return { success: true, isMaximized: targetWindow.isMaximized() };
      }
      return { success: false, error: "Window not found" };
    });

    ipcMain.handle("window:maximize", (event, windowId) => {
      const targetWindow = windowId
        ? BrowserWindow.fromId(windowId)
        : BrowserWindow.fromWebContents(event.sender);
      if (targetWindow && !targetWindow.isDestroyed()) {
        if (targetWindow.isMaximized()) {
          targetWindow.unmaximize();
        } else {
          targetWindow.maximize();
        }
        return { success: true };
      }
      return { success: false, error: "Window not found" };
    });

    ipcMain.handle("window:toggle-size", (event) => {
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

        return { success: true };
      }
      return { success: false, error: "Window not found" };
    });

    ipcMain.handle("window:create", async (event, filePath, options) => {
      const window = await windowManager.createChildWindow(filePath, options);
      if (window) {
        return { success: true };
      }

      return { success: false, error: "Failed to create window" };
    });
  }

  registerFileEvents() {
    // 文件选择对话框
    ipcMain.handle("file:show-open-dialog", async (event, options) => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showOpenDialog(window, {
          title: "选择SSH私钥文件",
          defaultPath: "~/.ssh",
          properties: ["openFile", "showHiddenFiles"],
          ...options,
        });

        if (result.canceled) {
          return { success: false, canceled: true };
        }

        return {
          success: true,
          filePath: result.filePaths[0],
        };
      } catch (err) {
        error("文件选择对话框错误:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "未知错误",
        };
      }
    });
  }

  registerDebugEvents() {
    ipcMain.handle("debug:connect", async (event, formValues) => {
      try {
        const result = await debug.connect(event.sender.id, formValues);
        return result;
      } catch (err) {
        error("调试连接失败:", err);

        // 确保错误对象能够正确序列化
        if (err && typeof err === "object" && err.success === false) {
          // 如果是 ErrorResponse 对象，直接返回
          return {
            success: false,
            error: err.error || "调试连接失败",
            data: null,
          };
        }

        // 其他类型的错误
        return {
          success: false,
          error: err instanceof Error ? err.message : "调试连接失败",
          data: null,
        };
      }
    });

    ipcMain.handle("debug:disconnect", async (event, formValues) => {
      try {
        const result = await debug.disconnect(event.sender.id);
        return result;
      } catch (err) {
        error("断开调试连接失败:", err);

        // 确保错误对象能够正确序列化
        if (err && typeof err === "object" && err.success === false) {
          return {
            success: false,
            error: err.error || "断开调试连接失败",
            data: null,
          };
        }

        return {
          success: false,
          error: err instanceof Error ? err.message : "断开调试连接失败",
          data: null,
        };
      }
    });
  }

  registerAppEvents() {
    // 应用更新开始
    ipcMain.handle("app:update", async (event, options: IAppUpdateOptions) => {
      try {
        const updateWindow = BrowserWindow.fromWebContents(event.sender);
        if (!updateWindow) {
          throw new Error("无法获取更新窗口");
        }

        const updater = new AppUpdater(options, updateWindow);
        await updater.performUpdate();

        return { success: true };
      } catch (err) {
        error("应用更新失败:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "未知错误",
        };
      }
    });

    ipcMain.handle(
      "app:switch",
      async (event, options: IAppSwitcherOptions) => {
        try {
          const switchWindow = BrowserWindow.fromWebContents(event.sender);
          if (!switchWindow) {
            throw new Error("无法获取切换窗口");
          }

          const switcher = new AppSwitcher(options, switchWindow);
          await switcher.switchApp();

          return { success: true };
        } catch (err) {
          error("应用切换失败:", err);
          return {
            success: false,
            error: err instanceof Error ? err.message : "未知错误",
          };
        }
      },
    );

    ipcMain.handle(
      "app:get-current-app",
      async (event, options: IAppSwitcherOptions) => {
        try {
          const switchWindow = BrowserWindow.fromWebContents(event.sender);
          if (!switchWindow) {
            throw new Error("无法获取切换窗口");
          }

          const switcher = new AppSwitcher(options, switchWindow);
          const currentApp = await switcher.getCurrentApp();

          console.log(currentApp);

          return { success: true, currentApp };
        } catch (err) {
          error("应用切换失败:", err);
          return {
            success: false,
            error: err instanceof Error ? err.message : "未知错误",
          };
        }
      },
    );
  }

  registerNotificationEvents() {
    // 显示系统通知
    ipcMain.handle("notification:show", async (event, options) => {
      try {
        const { title, body, type = "info", silent = false } = options;

        // 检查系统是否支持通知
        if (!Notification.isSupported()) {
          return {
            success: false,
            error: "系统不支持通知功能",
          };
        }

        const notification = new Notification({
          title: title || "SSH Inspector",
          body,
          silent,
          icon: undefined, // 可以根据需要设置应用图标路径
        });

        // 显示通知
        notification.show();

        info("系统通知已显示:", { title, body, type });

        return {
          success: true,
        };
      } catch (err) {
        error("显示系统通知失败:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "未知错误",
        };
      }
    });

    // 检查通知权限
    ipcMain.handle("notification:check-permission", async () => {
      try {
        return {
          success: true,
          supported: Notification.isSupported(),
        };
      } catch (err) {
        return {
          success: false,
          supported: false,
          error: err instanceof Error ? err.message : "未知错误",
        };
      }
    });
  }
}

export default IPCEvents;
