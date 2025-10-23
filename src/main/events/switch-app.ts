import { BrowserWindow, dialog } from 'electron';
import log from 'electron-log';
import { sshManager } from '../managers';
import { ErrorResponse, SuccessResponse } from '../util';

export interface IAppSwitcherOptions {
  selectedApp: string;
}

export interface IUploadProgress {
  transferred: number;
  total: number;
  percentage: number; // 支持1位小数精度，如 45.6
  stage: 'writing' | 'restarting' | 'completed' | 'error';
  message: string;
}

/**
 * 应用切换
 */

const configPath = '/srv/yogoos/config.json';
const setFilePermissions = (filePath: string) => `sudo chmod 666 ${filePath}`;

class AppSwitcher {
  private window: BrowserWindow;

  constructor(windowId: number) {
    this.window = BrowserWindow.fromId(windowId) as BrowserWindow;
    this.window.once('closed', () => {
      // 清理引用
      this.window = null;
    });
  }

  // 发送进度更新到渲染进程
  private sendProgress(progress: Partial<IUploadProgress>) {
    if (this.window.isDestroyed()) {
      log.warn('Window is destroyed, cannot send progress update');
      return;
    }
    this.window.webContents.send('app:switch-progress', progress);
  }

  private async updateConfig(options: IAppSwitcherOptions): Promise<void> {
    const appName = options.selectedApp;

    if (!appName || !appName.trim()) {
      throw new Error('Application name cannot be empty');
    }

    this.sendProgress({
      percentage: 0,
      stage: 'writing',
      message: '开始写入配置文件...',
    });

    try {
      // Set file permissions for config.json
      await sshManager.executeCommand(setFilePermissions(configPath));

      // Read current config
      const currentConfig = await sshManager.executeCommand(
        `cat ${configPath}`,
      );
      const config = JSON.parse(currentConfig);

      // Update singleAppId
      config.singleAppId = appName;

      // Write updated config back
      const updatedConfigJson = JSON.stringify(config, null, 2);

      await sshManager.executeCommand(
        `echo '${updatedConfigJson}' > ${configPath}`,
      );

      this.sendProgress({
        percentage: 80,
        stage: 'writing',
        message: '开始写入配置文件...',
      });
    } catch (error) {
      log.error('Config update failed:', error);
      throw new Error(`Failed to update config for ${appName}`);
    }
  }

  public async switchApp(options: IAppSwitcherOptions): Promise<SuccessResponse<void> | ErrorResponse> {
    try {
      await this.updateConfig(options);

      this.sendProgress({
        percentage: 90,
        stage: 'restarting',
        message: '正在重启服务...',
      });

      // Restart luna service
      await sshManager.executeCommand('sudo systemctl restart luna');

      this.sendProgress({
        percentage: 100,
        stage: 'completed',
        message: '应用切换完成',
      });

      return new SuccessResponse(null);
    } catch (error) {
      log.error('App switch failed:', error);
      this.sendProgress({
        percentage: 100,
        stage: 'error',
        message: `应用切换失败: ${error.message}`,
      });
      return new ErrorResponse(`应用切换失败: ${error.message}`);
    }
  }

  public async getCurrentApp(): Promise<
    | SuccessResponse<{
        currentApp: string;
      }>
    | ErrorResponse
  > {
    try {
      const result = await sshManager.executeCommand(
        'cat /srv/yogoos/config.json',
      );
      const config = JSON.parse(result);

      console.log(new SuccessResponse({ currentApp: config.singleAppId }));
      return new SuccessResponse({ currentApp: config.singleAppId });
    } catch (error) {
      log.error('Failed to get current app:', error);
      return new ErrorResponse('获取当前应用失败');
    }
  }
}

export default AppSwitcher;
