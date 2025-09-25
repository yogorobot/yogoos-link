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
      resizable: true,
      ...opt,
    });
    this.mainWindow.once('close', () => {
      this.closeAllWindows();
      sshManager.removeConnection();
    });

    const loginWindow = this.getLoginWindow();
    if (loginWindow) {
      loginWindow?.close();
    }

    return this.mainWindow;
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
        options,
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
          win.close();
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
          win.close();
        }
      } catch (error) {
        log.warn(`关闭子窗口失败:`, error);
      }
    });
    this.childWindows.clear();
  }
}

export default new WindowManager();
