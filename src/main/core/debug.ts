import { sshManager } from '../managers';
import { BrowserWindow, dialog } from 'electron';
import { ErrorResponse, SuccessResponse } from '../util';

interface IFormValues {
  'local-port': string;
  'remote-port': string;
}

const setPermission = (permission: string) => {
  return `sudo chmod -R ${permission} /etc/systemd/system/luna.service`;
};

const getRemoteConfig = (port: string) => {
  return `grep -n remote-debugging-port=${port} /etc/systemd/system/luna.service | cut -d: -f1`;
};

const delRemoteCode = () => {
  return `sudo sed -i "s/--remote-debugging-port=[^ ]\\+ *\\?//g" /etc/systemd/system/luna.service`;
};

const enableRemoteDebugging = (port: string) => {
  return `sudo sed -i "s/luna.AppImage\\s/luna.AppImage --remote-debugging-port=${port} /g" /etc/systemd/system/luna.service`;
};

const restartServices = () => {
  return `sudo systemctl daemon-reload && sudo systemctl restart luna`;
};

class Debug {
  private activeTunnelId: string | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  window: BrowserWindow | null = null;

  constructor(windowId) {
    this.window = BrowserWindow.fromId(windowId);
    this.window?.on('closed', () => {
      this.window = null;
      this.cleanup();
    });
  }

  connect(formValues: IFormValues) {
    // 验证窗口对象
    if (this.window === null || this.window.isDestroyed()) {
      return Promise.resolve(new ErrorResponse('无法获取目标窗口'));
    }

    // 验证SSH连接
    if (!sshManager.sshConnection) {
      return Promise.resolve(
        new ErrorResponse('SSH连接未建立，请先建立SSH连接'),
      );
    }

    // 处理调试连接逻辑
    const localPort = formValues['local-port'];
    const remotePort = formValues['remote-port'];

    this.window.on('closed', () => {
      this.retryTimer && clearTimeout(this.retryTimer);
      this.retryTimer = null;
      // 窗口关闭时自动关闭隧道
      this.cleanup();
    });

    return new Promise(async (resolve, reject) => {
      try {
        await sshManager.executeCommand(setPermission('777'));
        const line = await sshManager.executeCommand(
          getRemoteConfig(remotePort),
        );

        if (!line) {
          const dialogRes = await dialog.showMessageBox({
            message:
              '目标主机未配置远程调试，是否启用？\n（注意：将重启目标主机服务）',
            buttons: ['启用并重启', '取消'],
            defaultId: 1,
          });

          if (dialogRes.response === 0) {
            await this.enableDebugConfig(formValues);
          } else {
            // 用户选择取消，执行相应逻辑
            return resolve(new ErrorResponse('用户取消操作'));
          }
        }

        // 使用 ssh2 API 建立隧道，增加重试机制
        let tunnelEstablished = false;
        let tunnelId: string | null = null;
        const maxTunnelRetries = 3;

        for (let attempt = 1; attempt <= maxTunnelRetries; attempt++) {
          try {
            console.log(
              `正在尝试建立SSH隧道 (第${attempt}/${maxTunnelRetries}次)...`,
            );
            console.log(
              `隧道参数: localhost:${localPort} -> localhost:${remotePort}`,
            );

            const tunnelResult = await sshManager.createTunnel({
              localHost: 'localhost',
              localPort: parseInt(localPort),
              remoteHost: 'localhost',
              remotePort: parseInt(remotePort),
            });

            console.log(`隧道创建结果:`, tunnelResult);

            if (tunnelResult.success) {
              tunnelEstablished = true;
              tunnelId = tunnelResult.data.tunnelId;
              this.activeTunnelId = tunnelId;
              console.log(`隧道创建成功: ${tunnelId}`);
              break;
            } else {
              throw new Error(tunnelResult.error || '隧道创建失败');
            }
          } catch (error) {
            console.error(
              `SSH隧道建立失败 (第${attempt}次尝试):`,
              error.message,
            );

            if (attempt === maxTunnelRetries) {
              return resolve(
                new ErrorResponse(
                  `SSH隧道建立失败，已尝试${maxTunnelRetries}次: ${error.message}`,
                ),
              );
            }

            // 等待后重试
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        if (!tunnelEstablished) {
          return resolve(new ErrorResponse('SSH隧道建立失败'));
        }

        const url = `http://localhost:${localPort}`;

        const checkUrl = async () => {
          let retryCount = 0;
          const maxRetries = 30; // 最大重试30次，约30秒

          const attemptConnection = async (): Promise<boolean> => {
            try {
              retryCount++;

              // 使用AbortController实现超时控制
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

              try {
                // 使用单个fetch请求代替http.get + fetch的组合
                const response = await fetch(
                  `http://localhost:${localPort}/json/list?t=${Date.now()}`,
                  {
                    method: 'GET',
                    signal: controller.signal,
                  },
                );

                clearTimeout(timeoutId);

                if (response.ok) {
                  const data = await response.json();
                  if (data && data.length > 0) {
                    console.log(`调试服务连接成功，尝试次数: ${retryCount}`);
                    resolve(
                      new SuccessResponse(url + data[0].devtoolsFrontendUrl),
                    );
                    return true;
                  }
                }
              } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
              }
            } catch (error) {
              console.log(
                `连接尝试 ${retryCount}/${maxRetries} 失败:`,
                error.message,
              );
            }

            if (retryCount >= maxRetries) {
              resolve(
                new ErrorResponse(`调试服务连接超时，已尝试${maxRetries}次`),
              );
              return true;
            }

            return false;
          };

          const retry = async () => {
            const done = await attemptConnection();
            if (!done) {
              this.retryTimer = setTimeout(retry, 1000);
            }
          };

          retry();
        };

        checkUrl();
      } catch (error) {
        resolve(new ErrorResponse(error.message || '未知错误'));
      }
    });
  }

  async disconnect() {
    try {
      // 使用 ssh2 API 关闭隧道
      if (this.activeTunnelId) {
        const success = sshManager.closeTunnel(this.activeTunnelId);
        if (success) {
          console.log(`隧道已关闭: ${this.activeTunnelId}`);
          this.activeTunnelId = null;
        } else {
          console.warn(`关闭隧道失败: ${this.activeTunnelId}`);
        }
      } else {
        console.log('没有活跃的隧道需要关闭');
      }
    } catch (error) {
      console.error('断开连接时出错:', error);
    }
  }

  private async enableDebugConfig(formValues): Promise<void> {
    // const targetWindow = BrowserWindow.fromId(windowId);
    // 处理调试连接逻辑
    const debuggingPort = formValues['remote-port'];

    await sshManager.executeCommand(delRemoteCode());

    await sshManager.executeCommand(enableRemoteDebugging(debuggingPort));

    await sshManager.executeCommand(restartServices());

    return new Promise((resolve) => setTimeout(resolve, 5000));
  }

  /**
   * 清理隧道资源
   * 窗口关闭或应用退出时调用
   */
  private cleanupTunnel(): void {
    if (this.activeTunnelId) {
      try {
        const success = sshManager.closeTunnel(this.activeTunnelId);
        if (success) {
          console.log(`窗口关闭，隧道已清理: ${this.activeTunnelId}`);
        } else {
          console.warn(`窗口关闭，隧道清理失败: ${this.activeTunnelId}`);
        }
      } catch (error) {
        console.error(`窗口关闭，清理隧道时出错:`, error);
      } finally {
        this.activeTunnelId = null;
      }
    }
  }

  /**
   * 清理所有资源
   * 应用退出时调用
   */
  public cleanup(): void {
    // 清理重试定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      console.log('已清理调试重试定时器');
    }

    // 清理隧道资源
    this.cleanupTunnel();
  }

  /**
   * 获取当前活跃的隧道ID
   * @returns 隧道ID或null
   */
  public getActiveTunnelId(): string | null {
    return this.activeTunnelId;
  }
}

export default Debug;
