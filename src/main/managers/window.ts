import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Menu,
  MenuItemConstructorOptions,
  Tray,
  shell,
  screen,
} from 'electron';
import { merge } from 'lodash';
import path from 'path';
import log from 'electron-log';
import { resolveHtmlPath } from '../util';
import MenuBuilder from '../menu';
import sshManager from './ssh';
import type { ActiveSSHConnectionInfo, PublicSSHCredentials } from './ssh';

class WindowManager {
  public connectionsWindow: BrowserWindow = null;

  private childWindows: Map<string, BrowserWindow> = new Map();

  private windowConnections: Map<number, string> = new Map();

  private isQuitting = false;

  private tray: Tray | null = null;

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
      this.connectionsWindow.hide();
    });
    this.connectionsWindow.once('closed', () => {
      this.connectionsWindow = null;
    });
    this.createTray();

    return this.connectionsWindow;
  }

  setQuitting(isQuitting: boolean): void {
    this.isQuitting = isQuitting;
  }

  showConnectionsWindow(): void {
    const connectionsWindow = this.getConnectionsWindow();
    if (!connectionsWindow) return;

    if (connectionsWindow.isMinimized()) {
      connectionsWindow.restore();
    }
    connectionsWindow.show();
    connectionsWindow.focus();
  }

  isMainWindowHiddenToTray(): boolean {
    const connectionsWindow = this.getConnectionsWindow();
    return Boolean(connectionsWindow && !connectionsWindow.isVisible());
  }

  prepareForQuit(): void {
    this.setQuitting(true);
    this.closeChildWindows();
    this.destroyTray();

    const connectionsWindow = this.getConnectionsWindow();
    if (connectionsWindow) {
      connectionsWindow.destroy();
      this.connectionsWindow = null;
    }

    this.windowConnections.clear();
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

  private static getConnectionLabel(credentials: PublicSSHCredentials): string {
    const target = `${credentials.username}@${credentials.host}:${credentials.port}`;
    if (credentials.useJumpHost && credentials.jumpHost) {
      return `${credentials.jumpHost} -> ${target}`;
    }
    return target;
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

  destroyTray(): void {
    if (!this.tray) return;

    this.tray.destroy();
    this.tray = null;
  }

  private createTray(): void {
    if (this.tray) return;

    const trayIconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'tray.png')
      : path.join(__dirname, '../../assets/tray.png');

    this.tray = new Tray(trayIconPath);
    this.tray.setToolTip('YOLINK');
    this.tray.on('click', () => this.showTrayMenu());
    this.tray.on('right-click', () => this.showTrayMenu());
  }

  private buildTrayMenu(): Menu {
    const activeConnections = sshManager.getActiveConnections();
    const connectionItems = this.buildTrayConnectionItems(activeConnections);

    return Menu.buildFromTemplate([
      ...connectionItems,
      { type: 'separator' },
      {
        label: '显示主窗口',
        click: () => this.showConnectionsWindow(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.prepareForQuit();
          app.quit();
        },
      },
    ]);
  }

  private buildTrayConnectionItems(
    activeConnections: ActiveSSHConnectionInfo[],
  ): MenuItemConstructorOptions[] {
    if (activeConnections.length === 0) {
      return [{ label: '暂无已连接设备', enabled: false }];
    }

    return activeConnections.map(({ connectionId, credentials }) => ({
      label: WindowManager.getConnectionLabel(credentials),
      click: () => this.selectConnectionFromTray(connectionId),
    }));
  }

  private showTrayMenu(): void {
    if (!this.tray) return;
    const trayMenu = this.buildTrayMenu();
    this.tray.popUpContextMenu(trayMenu);
  }

  private selectConnectionFromTray(connectionId: string): void {
    this.showConnectionsWindow();
    const connectionsWindow = this.getConnectionsWindow();
    connectionsWindow?.webContents.send('ssh:select-connection', {
      connectionId,
    });
  }
}

export default new WindowManager();
