import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { error } from 'electron-log';
import Debug from './debug';
import Window from './window';
import Logs from './logs';
import System from './system';
import ssh, { SSHCredentials } from '../managers/ssh';
import { sshManager, windowManager } from '../managers';
import { decodeBase64, ErrorResponse, SuccessResponse } from '../util';
import AppUpdater, { IAppUpdateOptions } from './app-update';
import AppSwitcher, { IAppSwitcherOptions } from './switch-app';
import Package from './package';
import FileManager from './file';
import NotificationManager from './notification';

/**
 * 获取或创建与特定窗口关联的类的实例。
 * 自动处理窗口关闭时的实例清理。
 */
function getOrCreateInstance<T>(
  instancesMap: Map<number, T>,
  event: IpcMainInvokeEvent,
  instanceClass: new (...args: any[]) => T,
): T {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    throw new Error('Unable to resolve BrowserWindow from IPC sender.');
  }

  const windowId = window.id;
  if (instancesMap.has(windowId)) {
    return instancesMap.get(windowId)!;
  }

  const newInstance = new instanceClass(windowId);
  instancesMap.set(windowId, newInstance);

  window.once('closed', () => {
    console.log(
      `窗口 ${windowId} 已关闭，正在清理 ${instanceClass.name} 实例...`,
    );
    instancesMap.delete(windowId);
  });

  return newInstance;
}

const getInstance = <T>(map: Map<number, T>, event: IpcMainInvokeEvent) =>
  map.get(BrowserWindow.fromWebContents(event.sender)?.id ?? -1);

class IPCEventsV2 {
  logInstances: Map<number, Logs> = new Map<number, Logs>();

  debugInstances: Map<number, Debug> = new Map<number, Debug>();

  packageInstances: Map<number, Package> = new Map<number, Package>();

  systemInstances: Map<number, System> = new Map<number, System>();

  fileManagerInstances: Map<number, FileManager> = new Map<
    number,
    FileManager
  >();

  notificationManagerInstances: Map<number, NotificationManager> = new Map<
    number,
    NotificationManager
  >();

  windowInstances: Map<number, Window> = new Map<number, Window>();

  appSwitcherInstances: Map<number, AppSwitcher> = new Map<
    number,
    AppSwitcher
  >();

  appUpdaterInstances: Map<number, AppUpdater> = new Map<number, AppUpdater>();

  constructor() {
    this.resetInstances();

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

  resetInstances() {
    this.logInstances.clear();
    this.debugInstances.clear();
    this.packageInstances.clear();
    this.systemInstances.clear();
    this.fileManagerInstances.clear();
    this.notificationManagerInstances.clear();
    this.windowInstances.clear();
    this.appSwitcherInstances.clear();
    this.appUpdaterInstances.clear();
  }

  registerPackageEvents() {
    ipcMain.handle('package:query', (event) => {
      return getOrCreateInstance(
        this.packageInstances,
        event,
        Package,
      ).queryPackages();
    });
    ipcMain.handle('package:clear', (event) => {
      return getOrCreateInstance(
        this.packageInstances,
        event,
        Package,
      ).clearPackages();
    });
    ipcMain.handle('package:clear-single', (event, packageId: number) => {
      return getOrCreateInstance(
        this.packageInstances,
        event,
        Package,
      ).clearSinglePackage(packageId);
    });
  }

  registerSystemEvents() {
    ipcMain.handle('system:reboot', async (event) => {
      return await getOrCreateInstance(
        this.systemInstances,
        event,
        System,
      ).rebootWithConfirmation();
    });

    ipcMain.handle('system:getStorageInfo', async (event) => {
      return await getOrCreateInstance(
        this.systemInstances,
        event,
        System,
      ).getStorageInfo();
    });

    ipcMain.handle('system:getServicesUsingTFCard', async (event) => {
      return await getOrCreateInstance(
        this.systemInstances,
        event,
        System,
      ).getServicesUsingTFCard();
    });
  }

  registerLogEvents() {
    ipcMain.handle('log:get-history-list', (event) => {
      return getOrCreateInstance(
        this.logInstances,
        event,
        Logs,
      ).getHistoryLogList();
    });

    ipcMain.handle('log:get-stream-realtime-file', (event) => {
      return getOrCreateInstance(
        this.logInstances,
        event,
        Logs,
      ).getStreamRealtimeFile();
    });

    ipcMain.handle('log:get-stream-realtime', (event, options) => {
      return getOrCreateInstance(
        this.logInstances,
        event,
        Logs,
      ).getStreamRealtime(options);
    });

    ipcMain.handle('log:get-stream-history', (event, options) => {
      return getOrCreateInstance(
        this.logInstances,
        event,
        Logs,
      ).getStreamHistory(options);
    });

    ipcMain.handle('log:clear-stream', (event) => {
      return (
        getInstance(this.logInstances, event)?.cleanup() ?? Promise.resolve()
      );
    });
  }

  registerSSHEvents() {
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

    ipcMain.handle('ssh:disconnect', (event) => {
      sshManager.removeConnection();
      // const win = BrowserWindow.fromId(event.sender.id);
      // win.close();
    });
  }

  registerWindowEvents() {
    ipcMain.handle('window:get-current-info', (event) => {
      return getOrCreateInstance(
        this.windowInstances,
        event,
        Window,
      ).getCurrentInfo();
    });

    ipcMain.handle('window:create', async (event, filePath, options) => {
      return getOrCreateInstance(
        this.windowInstances,
        event,
        Window,
      ).createChildWindow(filePath, options);
    });
  }

  registerFileEvents() {
    ipcMain.handle('file:show-open-dialog', (event, options) => {
      const a = getOrCreateInstance(
        this.fileManagerInstances,
        event,
        FileManager,
      ).showOpenDialog(options);
      return a;
    });
  }

  registerDebugEvents() {
    ipcMain.handle('debug:connect', (event, formValues) => {
      const debugInstance = getOrCreateInstance(
        this.debugInstances,
        event,
        Debug,
      );
      return debugInstance.connect(formValues);
    });

    ipcMain.handle('debug:disconnect', (event) => {
      const debugInstance = getInstance(this.debugInstances, event);
      return debugInstance?.cleanup();
    });
  }

  registerAppEvents() {
    // AppUpdater 和 AppSwitcher 是单次操作，因此每次都创建新实例，不使用 getOrCreateInstance
    ipcMain.handle('app:update', async (event, options: IAppUpdateOptions) => {
      return getOrCreateInstance(
        this.appUpdaterInstances,
        event,
        AppUpdater,
      ).performUpdate(options);
    });

    ipcMain.handle(
      'app:switch',
      async (event, options: IAppSwitcherOptions) => {
        return getOrCreateInstance(
          this.appSwitcherInstances,
          event,
          AppSwitcher,
        ).switchApp(options);
      },
    );

    ipcMain.handle(
      'app:get-current-app',
      async (event, options: IAppSwitcherOptions) => {
        return getOrCreateInstance(
          this.appSwitcherInstances,
          event,
          AppSwitcher,
        ).getCurrentApp();
      },
    );
  }

  registerNotificationEvents() {
    ipcMain.handle('notification:show', (event, options) => {
      return getOrCreateInstance(
        this.notificationManagerInstances,
        event,
        NotificationManager,
      ).show(options);
    });
    ipcMain.handle('notification:check-permission', (event) => {
      return getOrCreateInstance(
        this.notificationManagerInstances,
        event,
        NotificationManager,
      ).checkPermission();
    });
  }
}

export default IPCEventsV2;
