import { app, BrowserWindow } from 'electron';
import log from 'electron-log';
import { autoUpdater, ProgressInfo, UpdateInfo } from 'electron-updater';
import { ErrorResponse, SuccessResponse } from '../util';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface AppUpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  progress?: number;
  error?: string;
  isTestingChannel: boolean;
}

class UpdateManager {
  private initialized = false;

  private state: AppUpdateState = {
    status: 'idle',
    currentVersion: app.getVersion(),
    isTestingChannel: UpdateManager.isTestingVersion(app.getVersion()),
  };

  initialize(): void {
    if (this.initialized) return;

    this.initialized = true;
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = this.state.isTestingChannel;

    autoUpdater.on('checking-for-update', () => {
      this.setState({ status: 'checking', error: undefined });
    });

    autoUpdater.on('update-available', (info) => {
      this.setUpdateInfo('available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
      this.setUpdateInfo('not-available', info);
    });

    autoUpdater.on('download-progress', (progress) => {
      this.setDownloadProgress(progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.setUpdateInfo('downloaded', info, 100);
    });

    autoUpdater.on('error', (error) => {
      this.setState({
        status: 'error',
        error: UpdateManager.normalizeUpdateError(error),
      });
    });
  }

  async checkForUpdates(manual = true) {
    this.initialize();

    if (!app.isPackaged) {
      const message = '开发环境不执行自动更新检查';
      if (manual) return new ErrorResponse(message);
      log.info(message);
      return new SuccessResponse(this.state);
    }

    try {
      this.setState({ status: 'checking', error: undefined });
      await autoUpdater.checkForUpdates();
      return new SuccessResponse(this.state);
    } catch (error) {
      const message = UpdateManager.normalizeUpdateError(error);
      this.setState({ status: 'error', error: message });
      return new ErrorResponse(message);
    }
  }

  async downloadUpdate() {
    this.initialize();

    if (this.state.status !== 'available') {
      return new ErrorResponse('当前没有可下载的更新');
    }

    try {
      this.setState({ status: 'downloading', progress: 0, error: undefined });
      await autoUpdater.downloadUpdate();
      return new SuccessResponse(this.state);
    } catch (error) {
      const message = UpdateManager.normalizeUpdateError(error, '更新下载失败');
      this.setState({ status: 'error', error: message });
      return new ErrorResponse(message);
    }
  }

  installUpdate() {
    this.initialize();

    if (this.state.status !== 'downloaded') {
      return new ErrorResponse('更新尚未下载完成');
    }

    autoUpdater.quitAndInstall(false, true);
    return new SuccessResponse(null);
  }

  getState() {
    return new SuccessResponse(this.state);
  }

  private setUpdateInfo(
    status: UpdateStatus,
    info: UpdateInfo,
    progress?: number,
  ): void {
    this.setState({
      status,
      availableVersion: info.version,
      releaseName: info.releaseName || null,
      releaseNotes: UpdateManager.stringifyReleaseNotes(info.releaseNotes),
      progress,
      error: undefined,
    });
  }

  private setDownloadProgress(progress: ProgressInfo): void {
    this.setState({
      status: 'downloading',
      progress: Math.round(progress.percent),
      error: undefined,
    });
  }

  private setState(nextState: Partial<AppUpdateState>): void {
    this.state = {
      ...this.state,
      ...nextState,
      currentVersion: app.getVersion(),
      isTestingChannel: UpdateManager.isTestingVersion(app.getVersion()),
    };
    this.broadcastState();
  }

  private broadcastState(): void {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update:event', this.state);
    });
  }

  private static isTestingVersion(version: string): boolean {
    return version.includes('testing');
  }

  private static normalizeUpdateError(
    error: unknown,
    fallback = '更新检查失败',
  ): string {
    const message =
      error instanceof Error ? error.message : String(error || '');

    if (
      message.includes('releases.atom') &&
      (message.includes('404') || message.includes('authentication token'))
    ) {
      return '更新源不可访问：GitHub Release 需要允许匿名访问。私有仓库不能直接用于客户端自动更新，请改用公开 Release 或公开更新源。';
    }

    if (message.includes('Please check update first')) {
      return '更新信息未准备好，请稍后重新检查更新。';
    }

    return message || fallback;
  }

  private static stringifyReleaseNotes(
    releaseNotes: UpdateInfo['releaseNotes'],
  ): string | null {
    if (!releaseNotes) return null;
    if (typeof releaseNotes === 'string') return releaseNotes;
    return releaseNotes.map((note) => note.note).join('\n');
  }
}

const updateManager = new UpdateManager();

export default updateManager;
