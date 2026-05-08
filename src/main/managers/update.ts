import { app, BrowserWindow, shell } from 'electron';
import log from 'electron-log';
import { ErrorResponse, SuccessResponse } from '../util';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'error';

export interface AppUpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  releaseUrl?: string;
  error?: string;
  hasRequiredAssets?: boolean;
  isTestingChannel: boolean;
}

interface GitHubReleaseAsset {
  name: string;
}

interface GitHubRelease {
  tag_name: string;
  name?: string | null;
  prerelease?: boolean;
  html_url?: string;
  body?: string | null;
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
      const release = await UpdateManager.findLatestAvailableRelease(
        app.getVersion(),
        this.state.isTestingChannel,
      );

      if (!release) {
        this.setState({
          status: 'not-available',
          availableVersion: undefined,
          releaseName: undefined,
          releaseNotes: undefined,
          releaseUrl: undefined,
          error: undefined,
          hasRequiredAssets: false,
        });
        return new SuccessResponse(this.state);
      }

      this.setUpdateInfo('available', release);
      return new SuccessResponse(this.state);
    } catch (error) {
      const message = UpdateManager.normalizeUpdateError(error);
      if (!manual) {
        log.warn(`自动更新检查失败：${message}`);
        this.setState({
          status: 'not-available',
          availableVersion: undefined,
          releaseName: undefined,
          releaseNotes: undefined,
          releaseUrl: undefined,
          error: undefined,
          hasRequiredAssets: false,
        });
        return new SuccessResponse(this.state);
      }

      this.setState({
        status: 'error',
        availableVersion: undefined,
        releaseName: undefined,
        releaseNotes: undefined,
        releaseUrl: undefined,
        error: message,
        hasRequiredAssets: false,
      });
      return new ErrorResponse(message);
    }
  }

  async openDownloadPage() {
    this.initialize();

    if (!this.state.releaseUrl) {
      return new ErrorResponse('当前没有可打开的下载页面');
    }

    try {
      await shell.openExternal(this.state.releaseUrl);
      return new SuccessResponse(null);
    } catch (error) {
      const message = UpdateManager.normalizeUpdateError(
        error,
        '打开下载页面失败',
      );
      return new ErrorResponse(message);
    }
  }

  getState() {
    return new SuccessResponse(this.state);
  }

  private setUpdateInfo(status: UpdateStatus, release: GitHubRelease): void {
    const version = UpdateManager.getVersionFromTag(release.tag_name);

    this.setState({
      status,
      availableVersion: version,
      releaseName: release.name || null,
      releaseNotes: release.body || null,
      error: undefined,
      releaseUrl: release.html_url || UpdateManager.getReleaseUrl(version),
      hasRequiredAssets: status === 'available',
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

  private static async findLatestAvailableRelease(
    currentVersion: string,
    allowPrerelease: boolean,
  ): Promise<GitHubRelease | null> {
    const response = await fetch(
      'https://api.github.com/repos/yogorobot/yogoos-link/releases?per_page=30',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'yolink-updater',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub Release 查询失败：${response.status}`);
    }

    const releases = (await response.json()) as GitHubRelease[];

    return (
      releases.find((release) => {
        const version = UpdateManager.getVersionFromTag(release.tag_name);
        const assetNames = (release.assets || []).map((asset) => asset.name);
        const isNewer =
          UpdateManager.compareVersions(version, currentVersion) > 0;
        const channelMatches = allowPrerelease || !release.prerelease;
        const hasAssets = UpdateManager.hasPlatformAssets(assetNames);

        if (isNewer && channelMatches && !hasAssets) {
          log.warn(`更新 ${version} 缺少当前平台所需资源，跳过更新提示`);
        }

        return isNewer && channelMatches && hasAssets;
      }) || null
    );
  }

  private static getVersionFromTag(tag: string): string {
    return tag.startsWith('v') ? tag.slice(1) : tag;
  }

  private static compareVersions(left: string, right: string): number {
    const leftParts = UpdateManager.getVersionNumbers(left);
    const rightParts = UpdateManager.getVersionNumbers(right);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
      const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (diff !== 0) return diff;
    }

    return 0;
  }

  private static getVersionNumbers(version: string): number[] {
    return version
      .replace(/^v/, '')
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map((part) => Number(part) || 0);
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

  private static getReleaseUrl(version: string): string {
    const tag = version.startsWith('v') ? version : `v${version}`;
    return `https://github.com/yogorobot/yogoos-link/releases/tag/${tag}`;
  }
}

const updateManager = new UpdateManager();

export default updateManager;
