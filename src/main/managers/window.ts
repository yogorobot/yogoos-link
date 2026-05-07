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
import { resolveHtmlPath } from '../util';
import MenuBuilder from '../menu';
import sshManager from './ssh';

class WindowManager {
  public connectionsWindow: BrowserWindow = null;

  private childWindows: Map<string, BrowserWindow> = new Map();

  private windowConnections: Map<number, string> = new Map();

  private isQuitting = false;

  async createConnectionsWindow(
    opt?: BrowserWindowConstructorOptions,
  ): Promise<BrowserWindow> {
    const isExistsWindow = this.getConnectionsWindow();
    if (isExistsWindow) {
      if (isExistsWindow.isMinimized()) {
        isExistsWindow.restore();
      }
      isExistsWindow.show();
      isExistsWindow.focus();
      return isExistsWindow;
    }
    this.connectionsWindow = await this.createWindow('connections', {
      width: 980,
      height: 680,
      titleBarStyle: 'hiddenInset',
      ...opt,
    });
    this.connectionsWindow.on('close', (event) => {
      if (this.isQuitting) return;

      event.preventDefault();
      this.connectionsWindow.minimize();
    });

    return this.connectionsWindow;
  }

  setQuitting(isQuitting: boolean): void {
    this.isQuitting = isQuitting;
  }

  async createChildWindow(
    route: string,
    opt?: BrowserWindowConstructorOptions,
    connectionId?: string,
  ): Promise<BrowserWindow> {
    const windowId = connectionId ? `${connectionId}:${route}` : route;
    const isExistsWindow = this.getChildWindowById(windowId);
    if (isExistsWindow) {
      isExistsWindow.focus();
      return isExistsWindow;
    }
    const window = await this.createWindow(
      route,
      {
        ...opt,
      },
      connectionId,
    );
    this.childWindows.set(windowId, window);
    window.once('close', () => {
      this.childWindows.delete(windowId);
      this.windowConnections.delete(window.id);
      log.info(`子窗口已关闭: ${windowId}`);
    });

    return window;
  }

  private static getDisplay() {
    const mousePosition = screen.getCursorScreenPoint();
    return (
      screen.getDisplayNearestPoint(mousePosition) || screen.getPrimaryDisplay()
    );
  }

  private static getTitle(connectionId?: string) {
    if (connectionId) {
      const credentials = sshManager.getPublicCredentials(connectionId);
      if (credentials?.host) {
        if (credentials.useJumpHost) {
          return `${credentials.jumpHost} -> ${credentials.host}`;
        }
        return credentials.host;
      }
    }

    return 'YOLINK';
  }

  private async createWindow(
    filePath: string,
    options?: BrowserWindowConstructorOptions,
    connectionId?: string,
  ): Promise<BrowserWindow> {
    const display = WindowManager.getDisplay();
    const { workArea } = display;
    const minWidth = Math.min(options?.minWidth || 420, workArea.width);
    const minHeight = Math.min(options?.minHeight || 420, workArea.height);
    const requestedWidth = options?.width || 1200;
    const requestedHeight = options?.height || 720;
    const width = Math.max(minWidth, Math.min(requestedWidth, workArea.width));
    const height = Math.max(
      minHeight,
      Math.min(requestedHeight, workArea.height),
    );
    const x = workArea.x + Math.floor((workArea.width - width) / 2);
    const y = workArea.y + Math.floor((workArea.height - height) / 2);

    const platformOptions: BrowserWindowConstructorOptions =
      process.platform === 'darwin'
        ? { titleBarStyle: 'hiddenInset' }
        : { autoHideMenuBar: true };

    const finalOptions = {
      ...options,
      width,
      height,
      minWidth,
      minHeight,
      x,
      y,
    };

    const win = new BrowserWindow(
      merge(
        {
          resizable: true,
          minimizable: true,
          maximizable: true,
          fullscreenable: true,
          backgroundColor: '#020617',
          title: WindowManager.getTitle(connectionId),
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
    if (connectionId) {
      this.windowConnections.set(win.id, connectionId);
    }
    new MenuBuilder(win).buildMenu();
    win.webContents.setWindowOpenHandler((data) => {
      shell.openExternal(data.url);
      return { action: 'deny' };
    });

    if (filePath === 'remote-debug') {
      win.webContents.on('console-message', (_event, level, message, line) => {
        log.info('[RemoteDebug:window-console]', { level, message, line });
      });
      win.webContents.on('did-attach-webview', (_event, webContents) => {
        log.info('[RemoteDebug:webview-attached]', {
          id: webContents.id,
          url: webContents.getURL(),
        });
        webContents.on(
          'console-message',
          (_consoleEvent, level, message, line) => {
            log.info('[RemoteDebug:webview-console]', { level, message, line });
          },
        );
        webContents.on(
          'did-fail-load',
          (
            _loadEvent,
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame,
          ) => {
            log.info('[RemoteDebug:webview-fail-load]', {
              errorCode,
              errorDescription,
              validatedURL,
              isMainFrame,
            });
          },
        );
      });
    }

    return win;
  }

  getConnectionsWindow(): BrowserWindow | null {
    if (this.connectionsWindow && this.connectionsWindow.isDestroyed()) {
      this.connectionsWindow = null;
    }
    return this.connectionsWindow;
  }

  getConnectionId(windowId: number): string | undefined {
    return this.windowConnections.get(windowId);
  }

  getChildWindowById(filePath: string): BrowserWindow | null {
    const window = this.childWindows.get(filePath);
    if (window && window.isDestroyed()) {
      this.childWindows.delete(filePath);
      return null;
    }
    return window;
  }

  closeChildWindows(connectionId?: string) {
    const windows = connectionId
      ? Array.from(this.childWindows.entries()).filter(([windowId]) =>
          windowId.startsWith(`${connectionId}:`),
        )
      : Array.from(this.childWindows.entries());

    windows.forEach(([windowId, win]) => {
      try {
        if (win) {
          win.destroy();
        }
        this.childWindows.delete(windowId);
      } catch (error) {
        log.warn(`关闭子窗口失败:`, error);
      }
    });
    if (!connectionId) {
      this.childWindows.clear();
    }
  }
}

export default new WindowManager();
