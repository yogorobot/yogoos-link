// import * as fs from 'fs';
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  shell,
  screen,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import { merge } from 'lodash';
import path from 'path';
import log from 'electron-log';
import { resolveHtmlPath, getAssetPath } from '../util';
import MenuBuilder from '../menu';
import { sshManager } from '.';
// import System from '../events/system';

class WindowManager {
  public loginWindow: BrowserWindow = null;
  public mainWindow: BrowserWindow = null;
  public childWindows: Map<string, BrowserWindow> = new Map();
  private tray: Tray | null = null;
  private isQuitting = false;

  constructor() {}

  async createLoginWindow(
    opt?: BrowserWindowConstructorOptions,
  ): Promise<BrowserWindow> {
    await this.closeAllWindows();
    const isExistsWindow = this.getLoginWindow();
    if (isExistsWindow) {
      isExistsWindow.focus();
      return isExistsWindow;
    }
    this.loginWindow = await this.createWindow('login', {
      resizable: false,
      width: 400,
      height: 620,
      titleBarStyle: 'hiddenInset',
      ...opt,
    });

    return this.loginWindow;
  }

  async createMainWindow(
    opt?: BrowserWindowConstructorOptions,
  ): Promise<BrowserWindow> {
    const isExistsWindow = this.getMainWindow();
    if (isExistsWindow) {
      isExistsWindow.focus();
      return isExistsWindow;
    }
    this.mainWindow = await this.createWindow('home', {
      resizable: false,
      ...opt,
    });

    this.mainWindow.on('close', (event) => {
      if (this.isQuitting) {
        return; // Allow the window to be destroyed
      }
      event.preventDefault();
      this.createTray(); // 在这里创建托盘图标
      this.hideMainWindow();
    });

    this.mainWindow.on('closed', () => {
      this.destroyTray();
    });

    const loginWindow = this.getLoginWindow();
    if (loginWindow) {
      loginWindow.destroy();
    }

    return this.mainWindow;
  }

  private destroyTray() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  createTray() {
    if (this.tray) return;
    const iconPath = getAssetPath('tray.png');
    const image = nativeImage.createFromPath(iconPath);

    try {
      if (process.platform === 'darwin') {
        // image.setTemplateImage(true);
        this.tray = new Tray(image);
      } else {
        const resizedIcon = image.resize({ width: 16, height: 16 });
        this.tray = new Tray(resizedIcon);
      }
    } catch (error) {
      log.error(
        '[Tray Debug] An unexpected error occurred during tray creation:',
        error,
      );
      return;
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示/隐藏应用',
        click: () => this.toggleWindowVisibility(),
      },

      { type: 'separator' },
      {
        label: '断开连接',
        click: () => {
          sshManager.removeConnection();
        },
      },
      { type: 'separator' },
      {
        label: '退出应用',
        click: () => {
          this.isQuitting = true;
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('YOLINK');

    this.tray.on('click', () => {
      // 单击托盘图标时判断
      // 如果主窗口已经显示，但没有获取焦点，则获取焦点
      if (process.platform === 'darwin') {
        if (!this.mainWindow?.isFocused()) {
          this.focusMainWindow();
        }
      } else {
        this.toggleWindowVisibility();
      }
    });
  }

  hideMainWindow() {
    this.mainWindow?.hide();
  }

  showMainWindow() {
    this.mainWindow?.show();
    this.destroyTray();
  }

  focusMainWindow() {
    this.mainWindow?.focus();
  }

  toggleWindowVisibility() {
    if (this.mainWindow?.isVisible()) {
      this.hideMainWindow();
    } else {
      this.showMainWindow();
    }
  }

  setQuitting(flag: boolean) {
    this.isQuitting = flag;
  }

  async createChildWindow(
    route: string,
    opt?: BrowserWindowConstructorOptions,
  ): Promise<BrowserWindow> {
    const isExistsWindow = this.getChildWindowById(route);
    if (isExistsWindow) {
      isExistsWindow.focus();
      return isExistsWindow;
    }
    const window = await this.createWindow(route, {
      resizable: false,
      ...opt,
    });
    this.childWindows.set(route, window);
    window.once('close', () => {
      this.childWindows.delete(route);
      log.info(`子窗口已关闭: ${route}`);
    });

    return window;
  }

  getDisplay() {
    const mousePosition = screen.getCursorScreenPoint();
    return (
      screen.getDisplayNearestPoint(mousePosition) || screen.getPrimaryDisplay()
    );
  }

  getTitle() {
    if (sshManager?.sshCredentials?.host) {
      if (sshManager?.sshCredentials?.useJumpHost) {
        return `${sshManager?.sshCredentials?.jumpHost} -> ${sshManager?.sshCredentials?.host}`;
      }
      return `${sshManager?.sshCredentials?.host}`;
    }

    return 'YOLINK';
  }

  private async createWindow(
    filePath: string,
    options?: BrowserWindowConstructorOptions,
  ): Promise<BrowserWindow> {
    const display = this.getDisplay();
    const defaultSize = {
      width: Math.min(1200, display.bounds.width),
      height: Math.min(720, display.bounds.height),
    };
    const width = options?.width || defaultSize.width;
    const height = options?.height || defaultSize.height;
    const x = display.bounds.x + Math.floor((display.bounds.width - width) / 2);
    const y =
      display.bounds.y + Math.floor((display.bounds.height - height) / 2);

    const platformOptions: BrowserWindowConstructorOptions =
      process.platform === 'darwin' ? {} : { autoHideMenuBar: true };

    // 如果设置了 resizable: false，自动设置 maximizable 和 fullscreenable 为 false
    const finalOptions = { ...options };
    if (finalOptions.resizable === false) {
      if (finalOptions.maximizable === undefined) {
        finalOptions.maximizable = false;
      }
      if (finalOptions.fullscreenable === undefined) {
        finalOptions.fullscreenable = false;
      }
    }

    const win = new BrowserWindow(
      merge(
        {
          width,
          height,
          x,
          y,
          backgroundColor: '#1e293b',
          title: this.getTitle(),
          webPreferences: {
            preload: app.isPackaged
              ? path.join(__dirname, 'preload.js')
              : path.join(__dirname, '../../.erb/dll/preload.js'),
          },
        },
        platformOptions,
        finalOptions,
      ),
    );

    win.loadURL(decodeURIComponent(resolveHtmlPath(filePath)));
    new MenuBuilder(win).buildMenu();
    win.webContents.setWindowOpenHandler((data) => {
      shell.openExternal(data.url);
      return { action: 'deny' };
    });

    return win;
  }

  getLoginWindow(): BrowserWindow | null {
    if (this.loginWindow && this.loginWindow.isDestroyed()) {
      this.loginWindow = null;
    }
    return this.loginWindow;
  }

  getMainWindow(): BrowserWindow | null {
    if (this.mainWindow && this.mainWindow.isDestroyed()) {
      this.mainWindow = null;
    }
    return this.mainWindow;
  }

  getChildWindows(): BrowserWindow[] {
    return Array.from(this.childWindows.values()).filter(
      (win) => win && !win.isDestroyed(),
    );
  }

  getChildWindowById(filePath: string): BrowserWindow | null {
    const window = this.childWindows.get(filePath);
    if (window && window.isDestroyed()) {
      this.childWindows.delete(filePath);
      return null;
    }
    return window;
  }

  getAllWindows(): BrowserWindow[] {
    return [
      this.getLoginWindow(),
      this.getMainWindow(),
      ...this.getChildWindows(),
    ].filter(Boolean);
  }

  closeAllWindows() {
    const windows = this.getAllWindows();
    windows.forEach((win) => {
      try {
        if (win) {
          win.destroy();
        }
      } catch (error) {
        log.warn(`关闭窗口失败:`, error);
      }
    });
    this.mainWindow = null;
    this.loginWindow = null;
    this.childWindows.clear();
  }

  closeChildWindows() {
    const windows = this.getChildWindows();
    windows.forEach((win) => {
      try {
        if (win) {
          win.destroy();
        }
      } catch (error) {
        log.warn(`关闭子窗口失败:`, error);
      }
    });
    this.childWindows.clear();
  }
}

export default new WindowManager();
