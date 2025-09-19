import { app, BrowserWindow } from "electron";
import log from "electron-log";
import { windowManager, sshManager } from "./managers";
import IPCEvents from "./events";
import debug from "./core/debug";

// const installExtensions = async () => {
//   const installer = require('electron-devtools-installer');
//   const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
//   const extensions = ['REACT_DEVELOPER_TOOLS'];

//   return installer
//     .default(
//       extensions.map((name) => installer[name]),
//       forceDownload,
//     )
//     .catch(console.log);
// };

// 全局异常处理
// process.on('uncaughtException', (error) => {
//   log.error('全局未捕获异常:', error);
//   // 清理SSH资源
//   try {
//     sshManager.removeConnection();
//   } catch (cleanupError) {
//     log.error('清理SSH资源时出错:', cleanupError);
//   }

//   // 延迟退出，给日志系统时间记录
//   setTimeout(() => {
//     process.exit(1);
//   }, 1000);
// });

// process.on('unhandledRejection', (reason, promise) => {
//   log.error('全局未处理的Promise拒绝:', reason, 'at:', promise);
//   // Promise拒绝通常不需要退出应用，只记录日志
// });

// 应用退出时的资源清理
const cleanupAndExit = () => {
  log.info("应用退出清理开始...");

  try {
    // 清理调试资源
    debug.cleanup();

    // 清理SSH资源（包含所有清理逻辑）
    sshManager.removeConnection();

    log.info("资源清理完成");
  } catch (error) {
    log.error("资源清理过程中出错:", error);
  }
};

app.on("window-all-closed", () => {
  // 应用退出时清理所有资源
  log.info("所有窗口已关闭，清理资源...");
  cleanupAndExit();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 应用退出前清理资源
app.on("before-quit", () => {
  log.info("应用退出前清理资源...");
  cleanupAndExit();
});

app
  .whenReady()
  .then(() => {
    new IPCEvents();
    windowManager.createLoginWindow();
    app.on("activate", () => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length === 0) windowManager.createLoginWindow();
    });
  })
  .catch(console.log);
