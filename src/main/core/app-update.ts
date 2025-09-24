import { BrowserWindow, dialog } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { sshManager } from '../managers';

export interface IAppUpdateOptions {
  filePath: string;
  targetDirectory?: string;
}

export interface IUploadProgress {
  transferred: number;
  total: number;
  percentage: number; // 支持1位小数精度，如 45.6
  stage: 'uploading' | 'extracting' | 'restarting' | 'completed' | 'error';
  message: string;
}

/**
 * 手动更新工具类 - 基于ssh2精简实现
 * 支持文件上传、解压、配置更新和服务重启
 */
class AppUpdater {
  private options: IAppUpdateOptions;
  private window: BrowserWindow;

  constructor(options: IAppUpdateOptions, windowId: number) {
    this.options = options;
    this.window = BrowserWindow.fromId(windowId) as BrowserWindow;
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
    if (this.window.isDestroyed()) {
      log.warn('Window is destroyed, cannot send progress update');
      return;
    }
    this.window.webContents.send('app:update-progress', progress);
  }

  // 验证本地文件 - 精简版本
  private validateFile(): void {
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

  // 使用ssh2 SFTP上传文件 - 增强版本，支持超时和重试
  private async uploadFile(): Promise<string> {
    const fileName = path.basename(this.options.filePath);
    const targetDir = this.options.targetDirectory || '/srv/yogoos/apps/';
    const remotePath = `${targetDir}${fileName}`;
    const stats = fs.statSync(this.options.filePath);
    const totalSize = stats.size;

    this.sendProgress({
      stage: 'uploading',
      message: '开始上传文件...',
      percentage: 20,
    });

    // 实现重试机制
    const maxRetries = 3;
    let retryCount = 0;

    const attemptUpload = (): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (!sshManager.sshConnection) {
          return reject(new Error('SSH连接未建立'));
        }

        // 设置上传超时
        const uploadTimeout = 30 * 60 * 1000; // 30分钟超时
        let timeoutId: NodeJS.Timeout | null = null;
        let isCompleted = false;

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        };

        const handleTimeout = () => {
          if (!isCompleted) {
            isCompleted = true;
            cleanup();
            reject(new Error('上传超时，请检查网络连接'));
          }
        };

        timeoutId = setTimeout(handleTimeout, uploadTimeout);

        // 使用ssh2的SFTP功能
        sshManager.sshConnection.sftp((err, sftp) => {
          if (err) {
            cleanup();
            return reject(new Error(`SFTP连接失败: ${err.message}`));
          }

          const readStream = fs.createReadStream(this.options.filePath);
          const writeStream = sftp.createWriteStream(remotePath);

          let transferred = 0;
          let lastProgressTime = Date.now();

          // 监听上传进度
          readStream.on('data', (chunk) => {
            transferred += chunk.length;
            const now = Date.now();

            // 限制进度更新频率，避免过度更新UI
            if (now - lastProgressTime > 500) {
              // 每500ms更新一次
              lastProgressTime = now;

              // 提高精度，保留1位小数
              const uploadPercentage =
                Math.round((transferred / totalSize) * 1000) / 10;
              // 上传阶段占总进度的50%（20%-70%）
              const totalPercentage = Math.min(20 + uploadPercentage * 0.5, 70);

              this.sendProgress({
                stage: 'uploading',
                message: `上传进度: ${(transferred / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB`,
                percentage: Math.round(totalPercentage * 10) / 10,
                transferred,
                total: totalSize,
              });
            }
          });

          // 处理上传完成
          writeStream.on('close', () => {
            if (!isCompleted) {
              isCompleted = true;
              cleanup();

              this.sendProgress({
                stage: 'uploading',
                message: '文件上传完成',
                percentage: 70,
              });

              sftp.end();
              resolve(remotePath);
            }
          });

          // 处理上传错误
          writeStream.on('error', (error) => {
            if (!isCompleted) {
              isCompleted = true;
              cleanup();
              sftp.end();
              reject(new Error(`文件上传失败: ${error.message}`));
            }
          });

          readStream.on('error', (error) => {
            if (!isCompleted) {
              isCompleted = true;
              cleanup();
              sftp.end();
              reject(new Error(`文件读取失败: ${error.message}`));
            }
          });

          // 开始上传
          try {
            readStream.pipe(writeStream);
          } catch (pipeError) {
            if (!isCompleted) {
              isCompleted = true;
              cleanup();
              sftp.end();
              reject(new Error(`上传管道错误: ${pipeError.message}`));
            }
          }
        });
      });
    };

    // 重试逻辑
    while (retryCount < maxRetries) {
      try {
        return await attemptUpload();
      } catch (error) {
        retryCount++;
        log.error(`上传尝试 ${retryCount} 失败:`, error);

        if (retryCount >= maxRetries) {
          throw new Error(
            `上传失败，已重试 ${maxRetries} 次: ${error.message}`,
          );
        }

        // 等待后重试
        this.sendProgress({
          stage: 'uploading',
          message: `上传失败，正在重试 (${retryCount}/${maxRetries})...`,
          percentage: 20,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待2秒后重试
      }
    }

    throw new Error('上传失败：超出最大重试次数');
  }

  // 主要执行流程 - 精简的7步骤
  public async performUpdate(): Promise<void> {
    // const appName = this.options.selectedApp;

    try {
      // 文件验证
      this.sendProgress({
        stage: 'uploading',
        message: `验证文件...`,
        percentage: 5,
      });
      this.validateFile();

      // 准备远程环境
      this.sendProgress({
        stage: 'uploading',
        message: '准备远程环境...',
        percentage: 10,
      });

      const targetDir = this.options.targetDirectory || '/srv/yogoos/apps/';

      // 准备目标目录（无需临时目录）
      await this.runCommand(
        `mkdir -p ${targetDir} && sudo chmod -R 777 ${targetDir}`,
      );

      // 上传文件
      const remotePath = await this.uploadFile();

      // 解压文件
      if (remotePath) {
        this.sendProgress({
          stage: 'extracting',
          message: '解压文件...',
          percentage: 75,
        });

        const targetDir = this.options.targetDirectory || '/srv/yogoos/apps/';
        await this.runCommand(
          `unzip -o "${remotePath}" -d "${targetDir}" && rm -f "${remotePath}"`,
        );

        this.sendProgress({
          stage: 'extracting',
          message: '解压完成，已清理临时文件',
          percentage: 90,
        });
      }

      // 重启服务
      this.sendProgress({
        stage: 'restarting',
        message: `重启服务...`,
        percentage: 95,
      });

      await this.runCommand('sudo systemctl restart luna');

      // 完成
      this.sendProgress({
        stage: 'completed',
        message: `更新完成！`,
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
      await dialog.showMessageBox(this.window, {
        type: 'error',
        title: `更新失败`,
        message: `操作失败: ${errorMessage}`,
        buttons: ['确定'],
      });

      throw error;
    }
  }
}

export default AppUpdater;
