/**
 * 流式更新示例 - 无需临时文件的解决方案
 * 这是一个更高级的实现，可以边上传边解压
 */

import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import { sshManager } from '../managers';

class StreamingAppUpdater {
  private options: IAppUpdateOptions;
  private updateWindow: BrowserWindow;

  constructor(options: IAppUpdateOptions, updateWindow: BrowserWindow) {
    this.options = options;
    this.updateWindow = options;
  }

  // 流式解压上传 - 完全不需要远程临时文件
  private async streamingUpload(): Promise<void> {
    const targetDir = this.options.targetDirectory || '/srv/yogoos/apps/';

    return new Promise((resolve, reject) => {
      // 打开本地ZIP文件
      yauzl.open(this.options.filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        let processedFiles = 0;
        const totalFiles = zipfile.entryCount;

        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            // 目录条目
            const remoteDirPath = path.posix.join(targetDir, entry.fileName);

            // 创建远程目录
            sshManager.executeCommand(`mkdir -p "${remoteDirPath}"`)
              .then(() => {
                processedFiles++;
                this.sendProgress({
                  stage: 'extracting',
                  message: `创建目录: ${entry.fileName}`,
                  percentage: 20 + (processedFiles / totalFiles) * 60
                });
                zipfile.readEntry();
              })
              .catch(reject);
          } else {
            // 文件条目 - 直接流式上传
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);

              const remoteFilePath = path.posix.join(targetDir, entry.fileName);

              // 确保文件目录存在
              const fileDir = path.posix.dirname(remoteFilePath);
              sshManager.executeCommand(`mkdir -p "${fileDir}"`).then(() => {
                // 创建SFTP写入流
                sshManager.sshConnection.sftp((err, sftp) => {
                  if (err) return reject(err);

                  const writeStream = sftp.createWriteStream(remoteFilePath);

                  // 直接管道传输
                  readStream.pipe(writeStream);

                  writeStream.on('close', () => {
                    processedFiles++;
                    this.sendProgress({
                      stage: 'extracting',
                      message: `处理文件: ${entry.fileName}`,
                      percentage: 20 + (processedFiles / totalFiles) * 60
                    });

                    if (processedFiles >= totalFiles) {
                      resolve();
                    } else {
                      zipfile.readEntry();
                    }
                  });

                  writeStream.on('error', reject);
                });
              }).catch(reject);
            });
          }
        });

        zipfile.on('end', () => {
          if (processedFiles >= totalFiles) {
            resolve();
          }
        });
      });
    });
  }

  // 简化的更新流程
  public async performStreamingUpdate(): Promise<void> {
    try {
      // 文件验证
      this.sendProgress({
        stage: 'uploading',
        message: '验证文件...',
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
      await this.runCommand(`mkdir -p ${targetDir} && sudo chmod -R 777 ${targetDir}`);

      // 流式解压上传（无需临时文件）
      this.sendProgress({
        stage: 'extracting',
        message: '开始流式部署...',
        percentage: 20,
      });

      await this.streamingUpload();

      // 重启服务
      this.sendProgress({
        stage: 'restarting',
        message: '重启服务...',
        percentage: 95,
      });

      await this.runCommand('sudo systemctl restart luna');

      // 完成
      this.sendProgress({
        stage: 'completed',
        message: '更新完成！',
        percentage: 100,
      });

    } catch (error) {
      // 错误处理逻辑...
      throw error;
    }
  }
}
