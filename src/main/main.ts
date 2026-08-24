import { app } from 'electron';
import log from 'electron-log';
import { windowManager, sshManager, updateManager } from './managers';
import IPCEventsV2 from './events';

// 禁用 Chromium 的自动隐藏悬浮滚动条特性，确保桌面端滚动条常驻
app.commandLine.appendSwitch('disable-features', 'OverlayScrollbar');

let hasCleanedUp = false;

// 应用退出时的资源清理
const cleanupAndExit = () => {
  if (hasCleanedUp) return;
  hasCleanedUp = true;

  log.info('应用退出清理开始...');

  try {
    windowManager.prepareForQuit();
    sshManager.removeAllConnections();

    log.info('资源清理完成');
  } catch (error) {
    log.error('资源清理过程中出错:', error);
  }
};

app.on('window-all-closed', () => {
  if (windowManager.isMainWindowHiddenToTray()) {
    return;
  }

  // 应用退出时清理所有资源
  log.info('所有窗口已关闭，清理资源...');
  cleanupAndExit();

  // // 在开发模式下，关闭窗口就退出应用
  // if (process.env.NODE_ENV === 'development') {
  //   app.quit();
  //   return;
  // }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理资源
app.on('before-quit', () => {
  log.info('应用退出前清理资源...');
  cleanupAndExit();
});

app
  .whenReady()
  .then(() => {
    const ipcEvents = new IPCEventsV2();
    windowManager.createConnectionsWindow();
    updateManager.initialize();
    updateManager.checkForUpdates(false);
    app.on('activate', () => {
      const connectionsWindow = windowManager.getConnectionsWindow();
      if (connectionsWindow) {
        windowManager.showConnectionsWindow();
      } else {
        windowManager.createConnectionsWindow();
      }
      return null;
    });
    return ipcEvents;
  })
  .catch((error) => log.error(error));
