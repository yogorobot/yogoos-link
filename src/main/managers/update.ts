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
  hasRequiredAssets?: boolean;
  isTestingChannel: boolean;
}

interface GitHubReleaseAsset {
  name: string;
}

interface GitHubRelease {
  assets?: GitHubReleaseAsset[];
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
      this.handleUpdateAvailable(info);
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
      hasRequiredAssets: status === 'available' || status === 'downloaded',
    });
  }

  private async handleUpdateAvailable(info: UpdateInfo): Promise<void> {
    try {
      const hasRequiredAssets = await UpdateManager.hasRequiredReleaseAssets(
        info.version,
      );

      if (!hasRequiredAssets) {
        log.warn(`更新 ${info.version} 缺少当前平台所需资源，跳过更新提示`);
        this.setUpdateInfo('not-available', info);
        this.setState({ hasRequiredAssets: false });
        return;
      }

      this.setUpdateInfo('available', info);
    } catch (error) {
      const message = UpdateManager.normalizeUpdateError(
        error,
        '更新资源校验失败',
      );
      log.warn(`更新 ${info.version} 资源校验失败：${message}`);
      this.setUpdateInfo('not-available', info);
      this.setState({ hasRequiredAssets: false });
    }
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

  private static async hasRequiredReleaseAssets(
    version: string,
  ): Promise<boolean> {
    const tag = version.startsWith('v') ? version : `v${version}`;
    const response = await fetch(
      `https://api.github.com/repos/yogorobot/yogoos-link/releases/tags/${tag}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'yolink-updater',
        },
      },
    );

    if (!response.ok) return false;

    const release = (await response.json()) as GitHubRelease;
    const assetNames = (release.assets || []).map((asset) => asset.name);

    return UpdateManager.hasPlatformAssets(assetNames);
  }

  private static hasPlatformAssets(assetNames: string[]): boolean {
    const hasAsset = (matcher: (assetName: string) => boolean) =>
      assetNames.some(matcher);

    if (process.platform === 'darwin') {
      return (
        hasAsset((assetName) => assetName === 'latest-mac.yml') &&
        hasAsset((assetName) =>
          ['.dmg', '.zip'].some((extension) => assetName.endsWith(extension)),
        )
      );
    }

    if (process.platform === 'win32') {
      return (
        hasAsset((assetName) => assetName === 'latest.yml') &&
        hasAsset((assetName) => assetName.endsWith('.exe'))
      );
    }

    if (process.platform === 'linux') {
      return (
        hasAsset((assetName) => assetName === 'latest-linux.yml') &&
        hasAsset((assetName) =>
          ['.AppImage', '.deb', '.rpm'].some((extension) =>
            assetName.endsWith(extension),
          ),
        )
      );
    }

    return false;
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
