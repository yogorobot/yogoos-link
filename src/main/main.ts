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
    // if (
    //   !(windowManager as any).isCreatingLogin?.() &&
    //   !windowManager.isCreatingLogin?.()
    // ) {
    //   // 如果不是在创建登录页，但之前标记了要回到登录页，则立即重开
    //   if (
    //     (windowManager as any).consumeReopenLoginRequest?.() ||
    //     windowManager.consumeReopenLoginRequest?.()
    //   ) {
    //     log.info('所有窗口关闭，重新打开登录窗口');
    //     // 某些情况下 window-all-closed 发生时 app 仍然 ready
    //     if (app.isReady()) {
    //       windowManager.createLoginWindow();
    //       return; // 不退出
    //     }
    //   }
    //   app.quit();
    // } else {
    //   log.info('检测到登录窗口创建流程，暂不退出应用');
    // }
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
