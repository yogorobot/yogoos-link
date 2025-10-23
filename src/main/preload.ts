import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type SystemChannels =
  | 'system:reboot'
  | 'system:shutdown'
  | 'system:getStorageInfo'
  | 'system:getServicesUsingTFCard';
type PackageChannels = 'package:query' | 'package:clear' | 'package:clear-single';

// 定义允许的 IPC 通道
type WindowChannels =
  | 'window:set-size'
  | 'window:get-current-info'
  | 'window:minimize'
  | 'window:maximize'
  | 'window:toggle-size'
  | 'window:toggle-maximize'
  | 'window:close'
  | 'window:create';

type LogChannels =
  | 'log:get-history-list'
  | 'log:get-stream-realtime-file'
  | 'log:get-stream-realtime'
  | 'log:get-stream-history'
  | 'log:stream-start'
  | 'log:stream-stop'
  | 'log:stream-data'
  | `log:stream-data-${string}`
  | 'log:clear-stream';

// 其余代码保持不变
type SSHChannels = 'ssh:authenticate' | 'ssh:disconnect';

type FileChannels = 'file:show-open-dialog';

type DebugChannels = 'debug:connect' | 'debug:disconnect';

type AppChannels =
  | 'app:update'
  | 'app:switch'
  | 'app:switch-progress'
  | 'app:update-progress'
  | 'app:get-current-app';

type NotificationChannels =
  | 'notification:show'
  | 'notification:check-permission';

type Channels =
  | WindowChannels
  | LogChannels
  | SSHChannels
  | FileChannels
  | AppChannels
  | DebugChannels
  | NotificationChannels
  | SystemChannels
  | PackageChannels;

export interface AuthInfo {
  host: string;
  port: string;
  username: string;
  password: string;
  // 跳板机相关配置
  useJumpHost?: boolean;
  jumpHost?: string;
  jumpPort?: string;
  jumpUsername?: string;
  jumpKeyFilePath?: string;
}

export interface IElectron {
  // IPC 渲染器 API
  ipcRenderer: {
    sendMessage: (channel: Channels, ...args: unknown[]) => void;
    on: (channel: Channels, func: (...args: unknown[]) => void) => () => void;
    once: (channel: Channels, func: (...args: unknown[]) => void) => void;
    invoke: (channel: Channels, ...args: unknown[]) => Promise<any>;
  };
}

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },

    invoke(channel: Channels, ...args: unknown[]) {
      return ipcRenderer.invoke(channel, ...args);
    },
  },
} as IElectron);

window.addEventListener('contextmenu', ev => {
  // 阻止默认行为
  ev.preventDefault();
});
