import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  shell,
  screen,
} from 'electron';
import { merge } from 'lodash';
import path from 'path';
import log from 'electron-log';
import { encodeBase64, resolveHtmlPath } from '../util';
import MenuBuilder from '../menu';
import { sshManager } from '.';

class WindowManager {
  public loginWindow: BrowserWindow = null;
  public mainWindow: BrowserWindow = null;
  public childWindows: Map<string, BrowserWindow> = new Map();

  async createLoginWindow(
    opt?: BrowserWindowConstructorOptions,
  ): Promise<BrowserWindow> {
    try {
      log.info('开始创建登录窗口...');

      // 先安全地关闭所有窗口
      await this.safeCloseAllWindows();

      const isExistsWindow = this.loginWindow;

      if (isExistsWindow && !isExistsWindow.isDestroyed()) {
        log.info('登录窗口已存在，聚焦到该窗口');
        isExistsWindow.focus();
        return isExistsWindow;
      }

      // 登录窗口保持不可调整大小，并设置合适的固定尺寸
      this.loginWindow = await this.createWindow('login', {
        resizable: false,
        width: 420, // 从460px调整为420px，更合适的宽度
        height: 680,
        ...opt,
      });

      log.info('登录窗口创建成功');
      return this.loginWindow;
    } catch (error) {
      log.error('创建登录窗口失败:', error);
      log.info('执行应用退出');
      app.quit();
      throw error;
    }
  }

  /**
   * 安全地关闭所有窗口
   * 添加错误处理，确保即使部分窗口关闭失败也不会影响整体流程
   */
  private async safeCloseAllWindows(): Promise<void> {
    try {
      log.info('开始安全关闭所有窗口...');

      const allWindows = this.getAllWindows();
      log.info(`找到 ${allWindows.length} 个窗口需要关闭`);

      // 并发关闭所有窗口，但不等待完成
      const closePromises = allWindows.map(async (win, index) => {
        try {
          if (win && !win.isDestroyed()) {
            log.info(`关闭窗口 ${index + 1}/${allWindows.length}`);
            win.close();
            // 给每个窗口一个短暂的关闭时间
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } catch (error) {
          log.warn(`关闭窗口 ${index + 1} 失败:`, error);
          // 不抛出错误，继续关闭其他窗口
        }
      });

      // 等待所有关闭操作完成，但设置超时
      await Promise.race([
        Promise.allSettled(closePromises),
        new Promise((resolve) => setTimeout(resolve, 3000)), // 3秒超时
      ]);

      log.info('安全关闭所有窗口完成');
    } catch (error) {
      log.error('安全关闭窗口过程中发生错误:', error);
      // 不抛出错误，继续执行后续操作
    }
  }

  async createMainWindow(
    opt?: BrowserWindowConstructorOptions,
  ): Promise<BrowserWindow> {
    const isExistsWindow = this.mainWindow;

    if (isExistsWindow && !isExistsWindow.isDestroyed()) {
      isExistsWindow.focus();
      return isExistsWindow;
    }

    this.mainWindow = await this.createWindow('home', {
      resizable: true,
      ...opt,
    });

    (this.mainWindow as any).authInfo = encodeBase64(sshManager.sshCredentials);

    this.mainWindow.on('close', (events) => {
      // console.log(`主窗口已关闭: ${id}`);

      // 关闭所有隧道
      sshManager.closeAllTunnels();

      // 断开SSH连接
      sshManager.removeConnection();

      // 关闭所有子窗口
      this.childWindows.forEach((childWindow) => {
        childWindow?.close();
      });
    });

    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow?.close();
    }

    return this.mainWindow;
  }

  async createChildWindow(
    route: string,
    opt?: BrowserWindowConstructorOptions,
  ): Promise<BrowserWindow> {
    // 子窗口允许调整大小

    const isExistsWindow = this.getChildWindowById(route);

    if (isExistsWindow && !isExistsWindow.isDestroyed()) {
      isExistsWindow.focus();
      return isExistsWindow;
    }

    const childWindow = await this.createWindow(route, {
      resizable: true,
      ...opt,
    });

    (childWindow as any).authInfo = encodeBase64(sshManager.sshCredentials);

    childWindow.on('close', () => {
      this.childWindows.delete(route);
      log.info(`子窗口已关闭: ${route}`);
    });

    this.childWindows.set(route, childWindow);
    return childWindow;
  }

  getDisplay() {
    const displays = screen.getAllDisplays();
    // 获取鼠标对应的显示器
    const mousePosition = screen.getCursorScreenPoint();

    let currentDisplay =
      displays.find(
        (display) =>
          display.bounds.x <= mousePosition.x &&
          mousePosition.x < display.bounds.x + display.bounds.width &&
          display.bounds.y <= mousePosition.y &&
          mousePosition.y < display.bounds.y + display.bounds.height,
      ) || displays[0]; // 如果没找到匹配的显示器，使用第一个

    // if (!app.isPackaged) {
    //   currentDisplay = displays[0];
    // }

    return currentDisplay;
  }

  private async createWindow(
    filePath: string,
    options?: BrowserWindowConstructorOptions,
  ) {
    const display = this.getDisplay();

    const defaultWindowSize = {
      width: Math.min(1200, display.bounds.width),
      height: Math.min(720, display.bounds.height),
    };

    // 如果 options 中指定了尺寸，优先使用
    const actualWidth = options?.width || defaultWindowSize.width;
    const actualHeight = options?.height || defaultWindowSize.height;

    // 确保窗口尺寸不超过屏幕尺寸
    const safeWidth = Math.min(actualWidth, display.bounds.width - 100); // 留100px边距
    const safeHeight = Math.min(actualHeight, display.bounds.height - 100); // 留100px边距

    const initialX = Math.max(
      display.bounds.x + 50, // 最小边距
      display.bounds.x + Math.floor((display.bounds.width - safeWidth) / 2),
    );
    const initialY = Math.max(
      display.bounds.y + 50, // 最小边距
      display.bounds.y + Math.floor((display.bounds.height - safeHeight) / 2),
    );

    console.log(`=== 创建窗口调试信息 (${filePath}) ===`);
    console.log(`屏幕边界:`, display.bounds);
    console.log(`原始尺寸: ${actualWidth}x${actualHeight}`);
    console.log(`安全尺寸: ${safeWidth}x${safeHeight}`);
    console.log(`计算位置: (${initialX}, ${initialY})`);

    const win = new BrowserWindow(
      merge(
        {
          // title: options?.title,
          width: safeWidth,
          height: safeHeight,
          x: initialX,
          y: initialY,
          // resizable: false, // 由各个窗口类型自己决定
          // maximizable: false, // 禁止最大化
          // titleBarStyle: 'hidden',
          // frame: false,
          backgroundColor: '#1e293b', // 使用深色背景而不是透明
          titleBarStyle: 'hiddenInset', // 隐藏但保留控制按钮
          // 移除透明和毛玻璃效果，避免渲染残影问题
          // transparent: true,
          // vibrancy: 'fullscreen-ui',
          // visualEffectState: 'active',
          webPreferences: {
            experimentalFeatures: true,
            backgroundThrottling: false, // 防止背景时性能降级
            // transparent: true, // 移除渲染进程透明设置
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            preload: app.isPackaged
              ? path.join(__dirname, 'preload.js')
              : path.join(__dirname, '../../.erb/dll/preload.js'),
          },
        },
        options,
      ),
    );

    win.loadURL(decodeURIComponent(resolveHtmlPath(filePath)));

    // 验证窗口实际位置
    win.once('ready-to-show', () => {
      const actualBounds = win.getBounds();
      console.log(`窗口实际边界 (${filePath}):`, actualBounds);
    });

    const menuBuilder = new MenuBuilder(win);
    menuBuilder.buildMenu();

    // Open urls in the user's browser
    win.webContents.setWindowOpenHandler((data) => {
      shell.openExternal(data.url);
      return { action: 'deny' };
    });

    return win;
  }

  getMainWindow(): BrowserWindow | undefined {
    return this.mainWindow;
  }

  getChildWindows(): BrowserWindow[] {
    return Array.from(this.childWindows.values());
  }

  getChildWindowById(filePath: string): BrowserWindow | undefined {
    return this.childWindows.get(filePath);
  }

  getAllWindows(): BrowserWindow[] {
    return [this.mainWindow, ...this.childWindows.values()]
      .filter(Boolean)
      .filter((win) => !win?.isDestroyed());
  }

  closeAllWindows(): void {
    try {
      log.info('开始关闭所有窗口...');

      const allWindows = this.getAllWindows();
      log.info(`找到 ${allWindows.length} 个窗口需要关闭`);

      allWindows.forEach((win, index) => {
        try {
          const isDestroyed = win.isDestroyed();
          if (!isDestroyed) {
            log.info(`关闭窗口 ${index + 1}/${allWindows.length}`);
            win?.close();
          } else {
            log.info(`窗口 ${index + 1} 已经被销毁，跳过`);
          }
        } catch (error) {
          log.warn(`关闭窗口 ${index + 1} 时发生错误:`, error);
          // 继续关闭其他窗口，不中断流程
        }
      });

      log.info('关闭所有窗口完成');
    } catch (error) {
      log.error('关闭所有窗口过程中发生错误:', error);
      // 不抛出错误，确保不会中断应用流程
    }
  }
}

export default new WindowManager();
