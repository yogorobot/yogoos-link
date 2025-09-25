import { app, BrowserWindow } from 'electron';
import log from 'electron-log';
import { windowManager, sshManager } from './managers';
import IPCEventsV2 from '../main/events';

// 应用退出时的资源清理
const cleanupAndExit = () => {
  log.info('应用退出清理开始...');

  try {
    // 清理SSH资源（包含所有清理逻辑）
    sshManager.removeConnection();

    log.info('资源清理完成');
  } catch (error) {
    log.error('资源清理过程中出错:', error);
  }
};

app.on('window-all-closed', () => {
  // 应用退出时清理所有资源
  log.info('所有窗口已关闭，清理资源...');
  cleanupAndExit();

  // Windows/Linux 默认会退出应用。若当前正在切回登录窗口流程，避免立刻退出
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
    new IPCEventsV2();
    windowManager.createLoginWindow();
    app.on('activate', () => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length === 0) windowManager.createLoginWindow();
    });
  })
  .catch(console.log);
