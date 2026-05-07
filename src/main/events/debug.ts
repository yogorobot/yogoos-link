import { BrowserWindow } from 'electron';
import { sshManager } from '../managers';
import { ErrorResponse, SuccessResponse } from '../util';

interface IFormValues {
  'remote-port': string;
  'enable-debug'?: boolean;
}

interface DebugTarget {
  id?: string;
  title?: string;
  type?: string;
  url?: string;
  devtoolsFrontendUrl: string;
  devToolsUrl: string;
}

interface DebugConnectResult {
  localPort: number;
  remotePort: number;
  targets: DebugTarget[];
}

const buildLocalDevToolsUrl = (
  devtoolsFrontendUrl: string,
  localPort: number,
): string => {
  const baseUrl = `http://localhost:${localPort}`;
  const sourceUrl = new URL(devtoolsFrontendUrl, baseUrl);
  const localUrl = new URL(
    `${sourceUrl.pathname}${sourceUrl.search}${sourceUrl.hash}`,
    baseUrl,
  );
  const websocketTarget = localUrl.searchParams.get('ws');

  if (websocketTarget) {
    const pathStartIndex = websocketTarget.indexOf('/');
    const websocketPath =
      pathStartIndex >= 0 ? websocketTarget.slice(pathStartIndex) : '';
    localUrl.searchParams.set('ws', `localhost:${localPort}${websocketPath}`);
  }

  return localUrl.toString();
};

const normalizeDebugTargets = (
  targets: DebugTarget[],
  localPort: number,
): DebugTarget[] => {
  return targets
    .filter((target) => target.devtoolsFrontendUrl)
    .map((target) => {
      const devToolsUrl = buildLocalDevToolsUrl(
        target.devtoolsFrontendUrl,
        localPort,
      );
      console.info('[RemoteDebug:target-map]', {
        id: target.id,
        title: target.title,
        type: target.type,
        pageUrl: target.url,
        devtoolsFrontendUrl: target.devtoolsFrontendUrl,
        localPort,
        devToolsUrl,
      });

      return {
        ...target,
        devToolsUrl,
      };
    });
};

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

  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private activeRequestController: AbortController | null = null;

  private isCleanedUp = false;

  window: BrowserWindow | null = null;

  private connectionId: string;

  constructor(windowId, connectionId?: string) {
    this.window = BrowserWindow.fromId(windowId);
    if (!connectionId) {
      throw new Error('调试窗口没有绑定连接');
    }
    this.connectionId = connectionId;
    this.window?.once('closed', () => {
      this.window = null;
      this.cleanup();
    });
  }

  async connect(formValues: IFormValues) {
    this.isCleanedUp = false;
    // 处理调试连接逻辑
    const remotePort = formValues['remote-port'];

    try {
      await sshManager.executeCommand(this.connectionId, setPermission('777'));
      const line = await sshManager.executeCommand(
        this.connectionId,
        getRemoteConfig(remotePort),
      );

      if (!line) {
        if (!formValues['enable-debug']) {
          return new ErrorResponse('REMOTE_DEBUG_NOT_CONFIGURED');
        }

        await this.enableDebugConfig(formValues);
      }

      // 使用 ssh2 API 建立隧道，增加重试机制
      const maxTunnelRetries = 3;

      for (let attempt = 1; attempt <= maxTunnelRetries; attempt += 1) {
        try {
          console.log(
            `正在尝试建立调试通道 (第${attempt}/${maxTunnelRetries}次)...`,
          );
          console.log(
            `隧道参数: localhost:自动分配 -> localhost:${remotePort}`,
          );

          // eslint-disable-next-line no-await-in-loop
          const tunnelResult = await sshManager.createTunnel(
            this.connectionId,
            {
              localHost: 'localhost',
              localPort: 0,
              remoteHost: 'localhost',
              remotePort: parseInt(remotePort, 10),
            },
          );

          console.log(`隧道创建结果:`, tunnelResult);

          if (tunnelResult.success) {
            const { tunnelId, localPort: assignedLocalPort } =
              tunnelResult.data;
            if (!tunnelId || !assignedLocalPort) {
              return new ErrorResponse('调试通道端口分配失败');
            }
            this.activeTunnelId = tunnelId;
            console.log(`隧道创建成功: ${tunnelId}`);

            // 调用新的checkUrl方法
            // eslint-disable-next-line no-await-in-loop
            const result = await this.checkUrl(
              assignedLocalPort,
              parseInt(remotePort, 10),
            );

            console.log(result);

            return result;
          }
          throw new Error(tunnelResult.error || '隧道创建失败');
        } catch (error) {
          console.error(
            `调试通道建立失败 (第${attempt}次尝试):`,
            error.message,
          );

          if (attempt === maxTunnelRetries) {
            return new ErrorResponse(
              `调试通道建立失败，已尝试${maxTunnelRetries}次: ${error.message}`,
            );
          }

          // 等待后重试
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => {
            setTimeout(resolve, 2000);
          });
        }
      }

      return new ErrorResponse('调试通道建立失败');
    } catch (error) {
      return new ErrorResponse(error.message || '未知错误');
    }
  }

  /**
   * 检查调试URL是否可用
   * @param localPort 本地端口
   * @returns Promise<SuccessResponse<DebugConnectResult> | ErrorResponse>
   */
  async checkUrl(
    localPort: number,
    remotePort: number,
  ): Promise<SuccessResponse<DebugConnectResult> | ErrorResponse> {
    return new Promise((resolve) => {
      let retryCount = 0;
      const maxRetries = 30; // 最大重试30次，约30秒
      let isResolved = false;

      const resolveOnce = (
        response: SuccessResponse<DebugConnectResult> | ErrorResponse,
      ) => {
        if (isResolved) return;
        isResolved = true;
        resolve(response);
      };

      const attemptConnection = async (): Promise<boolean> => {
        if (this.isCleanedUp) {
          resolveOnce(new ErrorResponse('调试窗口已关闭'));
          return true;
        }

        try {
          retryCount += 1;

          // 使用AbortController实现超时控制
          const controller = new AbortController();
          this.activeRequestController = controller;
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
            if (this.activeRequestController === controller) {
              this.activeRequestController = null;
            }

            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data) && data.length > 0) {
                console.log(`调试服务连接成功，尝试次数: ${retryCount}`);
                const targets = normalizeDebugTargets(data, localPort);

                if (targets.length === 0) {
                  resolveOnce(new ErrorResponse('未发现可调试页面'));
                  return true;
                }

                resolveOnce(
                  new SuccessResponse({
                    localPort,
                    remotePort,
                    targets,
                  }),
                );
                return true;
              }
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            if (this.activeRequestController === controller) {
              this.activeRequestController = null;
            }
            throw fetchError;
          }
        } catch (error) {
          if (this.isCleanedUp) {
            resolveOnce(new ErrorResponse('调试窗口已关闭'));
            return true;
          }

          console.log(
            `连接尝试 ${retryCount}/${maxRetries} 失败:`,
            error.message,
          );
        }

        if (retryCount >= maxRetries) {
          resolveOnce(
            new ErrorResponse(`调试服务连接超时，已尝试${maxRetries}次`),
          );
          return true;
        }

        return false;
      };

      const retry = async () => {
        const done = await attemptConnection();
        if (!done && !this.isCleanedUp) {
          this.retryTimer = setTimeout(retry, 1000);
        }
      };

      retry();
    });
  }

  public async getTargets(): Promise<
    SuccessResponse<DebugTarget[]> | ErrorResponse
  > {
    if (!this.activeTunnelId) {
      return new ErrorResponse('调试通道未建立');
    }

    const tunnel = sshManager.getTunnel(this.connectionId, this.activeTunnelId);
    if (!tunnel?.localPort) {
      return new ErrorResponse('调试通道端口不存在');
    }

    try {
      console.log(`刷新调试页面列表: localhost:${tunnel.localPort}`);
      const response = await fetch(
        `http://localhost:${tunnel.localPort}/json/list?t=${Date.now()}`,
      );
      if (!response.ok) {
        return new ErrorResponse(`调试页面列表获取失败: ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        return new ErrorResponse('调试页面列表格式异常');
      }

      const targets = normalizeDebugTargets(data, tunnel.localPort);
      console.log(`调试页面列表数量: ${targets.length}`);
      return new SuccessResponse(targets);
    } catch (error) {
      return new ErrorResponse(error.message || '调试页面列表获取失败');
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private async enableDebugConfig(formValues): Promise<void> {
    // const targetWindow = BrowserWindow.fromId(windowId);
    // 处理调试连接逻辑
    const debuggingPort = formValues['remote-port'];

    await sshManager.executeCommand(this.connectionId, delRemoteCode());

    await sshManager.executeCommand(
      this.connectionId,
      enableRemoteDebugging(debuggingPort),
    );

    await sshManager.executeCommand(this.connectionId, restartServices());

    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });
  }

  /**
   * 清理所有资源
   * 应用退出时调用
   */
  public cleanup(): SuccessResponse<boolean> | ErrorResponse {
    this.isCleanedUp = true;

    if (this.activeRequestController) {
      this.activeRequestController.abort();
      this.activeRequestController = null;
    }

    // 清理重试定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
      console.log('已清理调试重试定时器');
    }

    // 清理隧道资源
    const result = sshManager.closeTunnel(
      this.connectionId,
      this.activeTunnelId,
    );
    this.activeTunnelId = null;
    return result;
  }
}

export default Debug;
