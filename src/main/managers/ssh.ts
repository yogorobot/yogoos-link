import { Client } from 'ssh2';

import log from 'electron-log';
import { windowManager } from '.';
import {
  encodeBase64,
  SuccessResponse,
  ErrorResponse,
  Response,
} from '../util';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SSHCredentials {
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

export interface TunnelOptions {
  localHost?: string; // 本地绑定地址
  localPort: number; // 本地端口
  remoteHost: string; // 远程主机地址
  remotePort: number; // 远程端口
  // SSH隧道源地址配置选项
  sourceHost?: string; // SSH隧道源地址，默认 '127.0.0.1'
  sourcePort?: number; // SSH隧道源端口，默认 0（自动分配）
}

export interface TunnelResult {
  localPort?: number;
  tunnelId?: string;
}

export class SSHAuthManager {
  public sshConnection: Client = null;
  public sshCredentials: SSHCredentials = null;

  private activeTunnels: Map<string, net.Server> = new Map();
  private tunnelCounter = 0;
  private tunnelStats: Map<
    string,
    { connectionCount: number; createdAt: Date }
  > = new Map();

  public async authenticateSSH(
    credentials: SSHCredentials,
  ): Promise<Response<string>> {
    return new Promise((resolve) => {
      // 如果使用跳板机
      if (credentials.useJumpHost) {
        this.connectThroughJumpHost(credentials, resolve);
      } else {
        this.connectDirectly(credentials, resolve);
      }
    });
  }

  private connectThroughJumpHost(
    credentials: SSHCredentials,
    resolve: (value: Response<string>) => void,
  ): void {
    // 预检查跳板机连通性
    log.info(
      `开始连接跳板机: ${credentials.jumpUsername}@${credentials.jumpHost}:${credentials.jumpPort || '22'}`,
    );
    log.info(
      `目标主机: ${credentials.username}@${credentials.host}:${credentials.port}`,
    );

    const jumpConn = new Client();
    const targetConn = new Client();

    jumpConn.on('ready', () => {
      log.info(`跳板机连接成功: ${credentials.jumpHost}`);

      // 通过跳板机连接到目标主机
      jumpConn.forwardOut(
        '127.0.0.1', // 本地地址
        0, // 本地端口（自动分配）
        credentials.host, // 目标主机
        parseInt(credentials.port), // 目标端口
        (err, stream) => {
          if (err) {
            log.error('跳板机转发失败:', err);
            jumpConn.end();
            resolve(new ErrorResponse(`跳板机转发失败: ${err.message}`));
            return;
          }

          // 配置目标连接选项
          const targetOptions: any = {
            sock: stream,
            username: credentials.username,
            password: credentials.password,
            readyTimeout: 10000,
            keepaliveInterval: 3000, // 每3秒发送一次keepalive包
            keepaliveCountMax: 2, // 2次无响应后断开连接
            keepalive: true,
            reconnect: false, // 禁用自动重连，由应用层控制
          };

          // 连接目标主机
          targetConn.on('ready', () => {
            log.info('目标主机连接成功');

            // 保存目标连接和跳板机连接
            this.sshConnection = targetConn;
            this.sshCredentials = credentials;

            // 设置连接处理器
            this.setupConnectionHandlers();

            // 当目标连接关闭时，也关闭跳板机连接
            targetConn.on('close', () => {
              jumpConn.end();
            });

            resolve(new SuccessResponse(encodeBase64(credentials)));
          });

          targetConn.on('error', (err) => {
            log.error('目标主机连接失败:', err);
            jumpConn.end();
            this.removeConnection();
            resolve(new ErrorResponse(`目标主机连接失败: ${err.message}`));
          });

          try {
            targetConn.connect(targetOptions);
          } catch (error) {
            jumpConn.end();
            this.removeConnection();
            resolve(
              new ErrorResponse(
                `目标连接配置错误: ${error instanceof Error ? error.message : '未知错误'}`,
              ),
            );
          }
        },
      );
    });

    jumpConn.on('error', (err) => {
      log.error('跳板机连接失败:', err);

      let errorMessage = `跳板机连接失败: ${err.message}`;

      if (
        err.message.includes('All configured authentication methods failed')
      ) {
        errorMessage = `SSH认证失败，请检查：\n1. SSH公钥是否已添加到跳板机\n2. 用户名是否正确: ${credentials.jumpUsername}\n3. 跳板机是否允许公钥认证`;
      }

      resolve(new ErrorResponse(errorMessage));
    });

    // 配置跳板机连接，支持SSH配置文件
    const jumpOptions: any = {
      host: credentials.jumpHost,
      port: parseInt(credentials.jumpPort || '22'),
      username: credentials.jumpUsername,
      readyTimeout: 10000, // 缩短到10秒
      keepaliveInterval: 3000, // 每3秒发送一次keepalive包
      keepaliveCountMax: 2, // 2次无响应后断开连接
      keepalive: true,
      reconnect: false, // 禁用自动重连，由应用层控制
      hostVerifier: () => true, // 默认跳过主机密钥验证，避免第一次连接问题
    };

    // 跳板机使用SSH密钥认证
    let keyPath = null;

    if (credentials.jumpKeyFilePath) {
      keyPath = credentials.jumpKeyFilePath.replace(/^~/, os.homedir());
      if (!fs.existsSync(keyPath)) {
        resolve(
          new ErrorResponse(
            `SSH密钥文件不存在: ${credentials.jumpKeyFilePath}`,
          ),
        );
        return;
      }
    } else {
      // 默认使用 ~/.ssh/id_rsa
      keyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
      if (!fs.existsSync(keyPath)) {
        resolve(
          new ErrorResponse(
            '未找到SSH密钥文件，请检查 ~/.ssh/id_rsa 或选择其他密钥文件',
          ),
        );
        return;
      }
    }

    try {
      jumpOptions.privateKey = fs.readFileSync(keyPath);
      log.info(`使用SSH密钥: ${keyPath}`);
    } catch (error) {
      resolve(new ErrorResponse(`读取SSH密钥失败: ${error.message}`));
      return;
    }

    log.info(
      `正在连接跳板机: ${credentials.jumpUsername}@${credentials.jumpHost}:${credentials.jumpPort || '22'}`,
    );
    log.info(
      `目标主机: ${credentials.username}@${credentials.host}:${credentials.port}`,
    );

    try {
      jumpConn.connect(jumpOptions);
    } catch (error) {
      resolve(
        new ErrorResponse(
          `跳板机连接配置错误: ${error instanceof Error ? error.message : '未知错误'}`,
        ),
      );
    }
  }

  private connectDirectly(
    credentials: SSHCredentials,
    resolve: (value: Response<string>) => void,
  ): void {
    const conn = new Client();

    conn.on('ready', () => {
      log.info('SSH连接成功');

      // 保存连接
      this.sshConnection = conn;
      this.sshCredentials = credentials;

      // 监听连接错误和关闭事件
      this.setupConnectionHandlers();

      resolve(new SuccessResponse(encodeBase64(credentials)));
    });

    conn.on('error', (err) => {
      log.error('SSH连接失败:', err);
      this.removeConnection();
      resolve(new ErrorResponse(`SSH连接失败: ${err.message}`));
    });

    // 连接配置
    const connectOptions: any = {
      host: credentials.host,
      port: parseInt(credentials.port),
      username: credentials.username,
      password: credentials.password,
      readyTimeout: 10000, // 10秒超时
      keepaliveInterval: 3000, // 每3秒发送一次keepalive包
      keepaliveCountMax: 2, // 2次无响应后断开连接
      keepalive: true,
      reconnect: false, // 禁用自动重连，由应用层控制
    };

    try {
      conn.connect(connectOptions);
    } catch (error) {
      this.removeConnection();
      resolve(
        new ErrorResponse(
          `连接配置错误: ${error instanceof Error ? error.message : '未知错误'}`,
        ),
      );
    }
  }

  private handleSSHError(errorMessage: string) {
    log.error('处理SSH错误:', errorMessage);
    // 先清理SSH连接资源
    this.removeConnection();
    // 然后安全地切换到登录窗口
    setImmediate(async () => {
      await windowManager.createLoginWindow();
    });
  }

  private handleConnectionClose() {
    log.info(`处理连接关闭: ${this.sshCredentials?.host}`);
    // 先清理SSH连接资源
    this.removeConnection();
    // 然后安全地切换到登录窗口
    setImmediate(async () => {
      await windowManager.createLoginWindow();
    });
  }

  private setupConnectionHandlers() {
    // 监听连接错误
    this.sshConnection.on('error', (err) => {
      log.error(`SSH连接错误:`, err);
      this.handleSSHError(err.message);
    });

    // 监听连接关闭
    this.sshConnection.on('close', () => {
      log.info(`SSH连接关闭: ${this.sshCredentials?.host}`);
      this.handleConnectionClose();
    });

    // 监听连接结束
    // this.sshConnection.on('end', () => {
    //   log.info(`SSH连接结束: ${this.sshCredentials?.host}`);
    //   this.handleConnectionClose();
    // });
  }

  // 获取完返回
  public executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.sshConnection) {
        return reject(new Error('SSH连接未建立'));
      }

      console.log('run: command::::', command);
      this.sshConnection.exec(command, (err, stream) => {
        if (err) {
          return reject(err);
        }

        let output = '';
        stream.on('close', (code) => {
          if (code !== 0) {
            return reject(new Error(`命令执行失败，退出码：${code}`));
          }

          console.log('output::', output);
          resolve(output);
        });

        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data) => {
          log.error(`SSH命令错误输出: ${data}`);
        });
      });
    });
  }

  public executePtyCommand(
    command: string,
    onData: (data: string) => void,
    onError?: (error: string) => void,
  ): Promise<() => void> {
    return new Promise((resolve, reject) => {
      if (!this.sshConnection) {
        return reject(new Error('SSH连接未建立'));
      }

      this.sshConnection.exec(command, { pty: true }, (err, stream) => {
        if (err) {
          return reject(err);
        }

        // 简单有效的停止函数
        const stopCommand = () => {
          if (stream) {
            console.log('stream.destroyed: ', stream.destroyed);
            if (stream.destroyed) return;
            stream.write('\x03'); // 发送 Ctrl+C，终止远程命令
            stream.close();
          }
        };

        stream.on('data', (data) => {
          onData(data.toString());
        });

        stream.stderr.on('data', (data) => {
          const errorMsg = data.toString();
          log.error(`SSH命令错误输出: ${errorMsg}`);
          if (onError) {
            onError(errorMsg);
          }
        });

        stream.on('close', (code) => {
          console.log('stream.readable: ', stream.readable);
          log.info(`长期运行命令结束，退出码：${code}`);
        });

        stream.on('error', (error) => {
          log.error(`流错误:`, error);
          if (onError) {
            onError(error.message);
          }
        });

        stream.on('exit', (code, signal) => {
          console.log('退出码:', code, '信号:', signal);
        });

        // 返回停止函数
        resolve(stopCommand);
      });
    });
  }

  // 清理连接
  public removeConnection(): void {
    console.log('SSH管理器清理开始...');

    // 先关闭所有隧道
    this.closeAllTunnels();

    // 关闭SSH连接
    if (this.sshConnection) {
      try {
        this.sshConnection.end();
        console.log('SSH连接已关闭');
      } catch (error) {
        console.error('SSH连接关闭时出错:', error);
      } finally {
        this.sshConnection = null;
      }
    }

    // 清理凭据信息
    this.sshCredentials = null;

    console.log('SSH管理器清理完成');
  }

  /**
   * 使用 ssh2 API 直接创建 SSH 道
   * @param options 道配置选项
   * @returns Promise<TunnelResult>
   */
  public async createTunnel(
    options: TunnelOptions,
  ): Promise<Response<TunnelResult>> {
    return new Promise((resolve) => {
      // 检查SSH连接状态
      if (!this.sshConnection) {
        return resolve(new ErrorResponse('SSH连接未建立，请先建立SSH连接'));
      }

      // 添加更详细的连接状态检查
      // 注意：由于ssh2的Client类型定义不包含私有属性，我们只能做基本检查
      log.info('创建隧道时SSH连接状态检查通过');
      const {
        localHost,
        localPort,
        remoteHost,
        remotePort,
        sourceHost,
        sourcePort,
      } = options;

      // 创建本地服务器
      const server = net.createServer();
      const tunnelId = `tunnel_${++this.tunnelCounter}_${Date.now()}`;

      // 监听新连接
      let connectionCount = 0;
      server.on('connection', (clientSocket) => {
        connectionCount++;

        // 获取客户端连接信息
        const clientIP = clientSocket.remoteAddress || 'unknown';
        const clientPort = clientSocket.remotePort || 0;

        // 更新统计信息
        const stats = this.tunnelStats.get(tunnelId);
        if (stats) {
          stats.connectionCount = connectionCount;
        }

        // 通过 SSH 连接到远程主机
        try {
          // 在调用 forwardOut 之前再次检查连接状态
          if (!this.sshConnection) {
            log.error('隧道创建时SSH连接无效:', {
              hasConnection: !!this.sshConnection,
              tunnelId,
            });
            clientSocket.end();
            return;
          }

          // 添加详细的调试信息输出，便于快速定位配置兼容性问题
          const actualSourceHost = sourceHost || '127.0.0.1';
          const actualSourcePort = sourcePort || 0;

          log.info('创建 SSH 隧道:', {
            隧道ID: tunnelId,
            SSH源地址: actualSourceHost,
            SSH源端口: actualSourcePort,
            目标地址: remoteHost,
            目标端口: remotePort,
            客户端信息: `${clientIP}:${clientPort}`,
          });

          this.sshConnection.forwardOut(
            actualSourceHost, // SSH隧道源地址（默认本地回环）
            actualSourcePort, // SSH隧道源端口（默认自动分配）
            remoteHost, // 目标主机
            remotePort, // 目标端口
            (err, stream) => {
              if (err) {
                log.error('创建远程连接失败:', {
                  error: err.message,
                  errorType: err.constructor.name,
                  remoteHost,
                  remotePort,
                  tunnelId,
                  connectionStatus: {
                    hasConnection: !!this.sshConnection,
                  },
                });
                clientSocket.end();
                return;
              }

              // 将本地客户端和远程流连接起来
              clientSocket.pipe(stream).pipe(clientSocket);

              // 处理连接关闭
              clientSocket.on('close', () => {
                // 减少关闭日志，只在出错时记录
              });

              stream.on('close', () => {
                clientSocket.end();
              });

              // 处理错误
              clientSocket.on('error', (error) => {
                log.error('本地客户端错误:', error);
                stream.end();
              });

              stream.on('error', (error) => {
                log.error('远程流错误:', error);
                clientSocket.end();
              });
            },
          );
        } catch (forwardError) {
          log.error('调用forwardOut时发生错误:', {
            error: forwardError.message,
            tunnelId,
            clientInfo: `${clientIP}:${clientPort}`,
            targetInfo: `${remoteHost}:${remotePort}`,
          });
          clientSocket.end();
        }
      });

      // 处理服务器错误
      server.on('error', (error) => {
        log.error(`隧道服务器错误 (隧道ID: ${tunnelId}):`, {
          error: error.message,
          code: (error as any).code,
          localHost,
          localPort,
          remoteHost,
          remotePort,
        });

        // 清理资源
        this.activeTunnels.delete(tunnelId);
        this.tunnelStats.delete(tunnelId);

        resolve(new ErrorResponse(`隧道服务器错误: ${error.message}`));
      });

      // 监听端口
      server.listen(localPort, localHost, () => {
        const address = server.address() as net.AddressInfo;
        const actualPort = address?.port || localPort;

        log.info(
          `SSH隧道已建立: ${localHost}:${actualPort} -> ${remoteHost}:${remotePort} (隧道ID: ${tunnelId})`,
        );

        // 保存隧道引用和统计信息
        this.activeTunnels.set(tunnelId, server);
        this.tunnelStats.set(tunnelId, {
          connectionCount: 0,
          createdAt: new Date(),
        });

        resolve(
          new SuccessResponse({
            localPort: actualPort,
            tunnelId,
          }),
        );
      });
    });
  }

  /**
   * 关闭指定的遀道
   * @param tunnelId 道ID
   * @returns boolean
   */
  public closeTunnel(tunnelId: string): boolean {
    const server = this.activeTunnels.get(tunnelId);
    if (!server) {
      log.warn(`遀道不存在: ${tunnelId}`);
      return false;
    }

    try {
      server.close(() => {
        log.info(`遀道已关闭: ${tunnelId}`);
      });
      this.activeTunnels.delete(tunnelId);
      this.tunnelStats.delete(tunnelId); // 清理统计信息
      return true;
    } catch (error) {
      log.error(`关闭遀道失败: ${tunnelId}`, error);
      return false;
    }
  }

  /**
   * 关闭所有活跃的遀道
   */
  public closeAllTunnels(): void {
    log.info(`正在关闭 ${this.activeTunnels.size} 个活跃遀道`);

    for (const [tunnelId, server] of this.activeTunnels) {
      try {
        server.close();
        log.info(`遀道已关闭: ${tunnelId}`);
      } catch (error) {
        log.error(`关闭遀道失败: ${tunnelId}`, error);
      }
    }

    this.activeTunnels.clear();
    this.tunnelStats.clear(); // 清理所有统计信息
  }

  /**
   * 获取活跃遀道列表
   * @returns 活躍遀道ID数组
   */
  public getActiveTunnels(): string[] {
    return Array.from(this.activeTunnels.keys());
  }

  /**
   * 检查隐道是否活跃
   * @param tunnelId 隐道ID
   * @returns boolean
   */
  public isTunnelActive(tunnelId: string): boolean {
    const server = this.activeTunnels.get(tunnelId);
    return server ? server.listening : false;
  }

  /**
   * 获取隐道统计信息
   * @param tunnelId 隐道ID
   * @returns 隐道统计信息或null
   */
  public getTunnelStats(
    tunnelId: string,
  ): { connectionCount: number; createdAt: Date; uptime: number } | null {
    const stats = this.tunnelStats.get(tunnelId);
    if (!stats) {
      return null;
    }

    return {
      ...stats,
      uptime: Date.now() - stats.createdAt.getTime(),
    };
  }

  /**
   * 获取所有隐道的统计信息
   * @returns 隐道统计信息列表
   */
  public getAllTunnelStats(): Array<{
    tunnelId: string;
    connectionCount: number;
    createdAt: Date;
    uptime: number;
    active: boolean;
  }> {
    const result = [];

    for (const [tunnelId, stats] of this.tunnelStats.entries()) {
      result.push({
        tunnelId,
        connectionCount: stats.connectionCount,
        createdAt: stats.createdAt,
        uptime: Date.now() - stats.createdAt.getTime(),
        active: this.isTunnelActive(tunnelId),
      });
    }

    return result;
  }
}

export default new SSHAuthManager();
