import { BrowserWindow, dialog } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { sshManager } from '../managers';

export interface IManualUpdateOptions {
  filePath: string;
  targetDirectory?: string;
  selectedApp?: string;
  modifyAppOnly?: boolean;
}

export interface IUploadProgress {
  transferred: number;
  total: number;
  percentage: number;
  stage: 'uploading' | 'extracting' | 'restarting' | 'completed' | 'error';
  message: string;
}

/**
 * 手动更新工具类 - 基于ssh2精简实现
 * 支持文件上传、解压、配置更新和服务重启
 */
class ManualUpdater {
  private options: IManualUpdateOptions;
  private updateWindow: BrowserWindow;

  constructor(options: IManualUpdateOptions, updateWindow: BrowserWindow) {
    this.options = options;
    this.updateWindow = updateWindow;
  }

  // 执行远程命令 - 统一错误处理
  private async runCommand(command: string): Promise<string> {
    try {
      return await sshManager.executeCommand(command);
    } catch (error) {
      log.error('远程命令执行失败:', command, error);
      throw error;
    }
  }

  // 发送进度更新到渲染进程
  private sendProgress(progress: Partial<IUploadProgress>) {
    this.updateWindow.webContents.send('manual-update-progress', progress);
  }

  // 验证本地文件 - 精简版本
  private validateFile(): void {
    if (this.options.modifyAppOnly || !this.options.filePath) {
      return; // 仅修改配置时跳过文件验证
    }

    if (!fs.existsSync(this.options.filePath)) {
      throw new Error('文件不存在');
    }

    const stats = fs.statSync(this.options.filePath);
    if (!stats.isFile() || !this.options.filePath.endsWith('.zip')) {
      throw new Error('只支持ZIP文件');
    }

    // 检查文件大小 (500MB限制)
    if (stats.size > 500 * 1024 * 1024) {
      throw new Error('文件超过500MB限制');
    }
  }

  // 使用ssh2 SFTP上传文件 - 核心改进
  private async uploadFile(): Promise<string> {
    if (this.options.modifyAppOnly || !this.options.filePath) {
      return '';
    }

    const fileName = path.basename(this.options.filePath);
    const remotePath = `/tmp/yogotool-updates/${fileName}`;
    const stats = fs.statSync(this.options.filePath);
    const totalSize = stats.size;

    this.sendProgress({
      stage: 'uploading',
      message: '开始上传文件...',
      percentage: 20,
    });

    return new Promise((resolve, reject) => {
      if (!sshManager.sshConnection) {
        return reject(new Error('SSH连接未建立'));
      }

      // 使用ssh2的SFTP功能
      sshManager.sshConnection.sftp((err, sftp) => {
        if (err) {
          return reject(new Error(`SFTP连接失败: ${err.message}`));
        }

        const readStream = fs.createReadStream(this.options.filePath);
        const writeStream = sftp.createWriteStream(remotePath);

        let transferred = 0;

        // 监听上传进度
        readStream.on('data', (chunk) => {
          transferred += chunk.length;
          const percentage = Math.round((transferred / totalSize) * 100);

          this.sendProgress({
            stage: 'uploading',
            message: `上传进度: ${Math.round(transferred / 1024 / 1024)}MB / ${Math.round(totalSize / 1024 / 1024)}MB`,
            percentage: Math.min(20 + (percentage * 0.4), 60), // 20%-60%
            transferred,
            total: totalSize,
          });
        });

        // 处理上传完成
        writeStream.on('close', () => {
          this.sendProgress({
            stage: 'uploading',
            message: '文件上传完成',
            percentage: 60,
          });

          sftp.end();
          resolve(remotePath);
        });

        // 处理上传错误
        writeStream.on('error', (error) => {
          sftp.end();
          reject(new Error(`文件上传失败: ${error.message}`));
        });

        readStream.on('error', (error) => {
          sftp.end();
          reject(new Error(`文件读取失败: ${error.message}`));
        });

        // 开始上传
        readStream.pipe(writeStream);
      });
    });
  }

  // 主要执行流程 - 精简的7步骤
  public async performUpdate(): Promise<void> {
    const appName = this.options.selectedApp || 'luna';
    const isConfigOnly = this.options.modifyAppOnly;

    try {
      // 步骤1: 文件验证
      this.sendProgress({
        stage: 'uploading',
        message: `验证文件 (${appName})...`,
        percentage: 5,
      });
      this.validateFile();

      // 步骤2: 准备远程环境
      if (!isConfigOnly) {
        this.sendProgress({
          stage: 'uploading',
          message: '准备远程环境...',
          percentage: 10,
        });

        const targetDir = this.options.targetDirectory || '/srv/yogoos/apps/';
        await this.runCommand(`mkdir -p /tmp/yogotool-updates`);
        await this.runCommand(`mkdir -p ${targetDir} && sudo chmod -R 777 ${targetDir}`);
      }

      // 步骤3: 上传文件
      const remotePath = await this.uploadFile();

      // 步骤4: 解压文件
      if (remotePath) {
        this.sendProgress({
          stage: 'extracting',
          message: '解压文件...',
          percentage: 70,
        });

        const targetDir = this.options.targetDirectory || '/srv/yogoos/apps/';
        await this.runCommand(`unzip -o "${remotePath}" -d "${targetDir}" && rm -f "${remotePath}"`);

        this.sendProgress({
          stage: 'extracting',
          message: '解压完成',
          percentage: 80,
        });
      }

      // 步骤5: 更新配置
      if (!this.options.selectedApp?.trim()) {
        throw new Error('应用名称不能为空');
      }

      this.sendProgress({
        stage: 'restarting',
        message: `更新${appName}配置...`,
        percentage: 85,
      });

      const configPath = '/srv/yogoos/config.json';
      const currentConfig = await this.runCommand(`sudo chmod 666 ${configPath} && cat ${configPath}`);
      const config = JSON.parse(currentConfig);
      config.singleAppId = this.options.selectedApp;

      await this.runCommand(`echo '${JSON.stringify(config, null, 2)}' > ${configPath}`);

      // 步骤6: 重启服务
      this.sendProgress({
        stage: 'restarting',
        message: `重启${appName}服务...`,
        percentage: 90,
      });

      await this.runCommand('sudo systemctl restart luna');

      // 步骤7: 完成
      this.sendProgress({
        stage: 'completed',
        message: `${isConfigOnly ? '配置更新' : '手动更新'} (${appName}) 完成！`,
        percentage: 100,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      this.sendProgress({
        stage: 'error',
        message: errorMessage,
        percentage: 0,
      });

      // 错误对话框
      await dialog.showMessageBox(this.updateWindow, {
        type: 'error',
        title: `${isConfigOnly ? '配置更新' : '手动更新'}失败`,
        message: `操作失败: ${errorMessage}`,
        buttons: ['确定'],
      });

      throw error;
    }
  }

  public destroy(): void {
    log.info(`ManualUpdater已销毁: ${this.options.selectedApp || 'unknown'}`);
  }
}

export default ManualUpdater;
