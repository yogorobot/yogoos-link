import log from 'electron-log';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Client } from 'ssh2';
import type { Client as SSH2Client, ClientChannel } from 'ssh2';
import { SuccessResponse, ErrorResponse, Response } from '../util';

export interface SSHCredentials {
  host: string;
  port: string;
  username: string;
  password: string;
  useJumpHost?: boolean;
  jumpHost?: string;
  jumpPort?: string;
  jumpUsername?: string;
  jumpAuthType?: 'password' | 'key';
  jumpPassword?: string;
  jumpKeyFilePath?: string;
}

export type PublicSSHCredentials = Omit<
  SSHCredentials,
  'password' | 'jumpPassword'
>;

export type ConnectionHealthStatus = 'online' | 'unstable';

export interface ActiveSSHConnectionInfo {
  connectionId: string;
  credentials: PublicSSHCredentials;
  healthStatus: ConnectionHealthStatus;
}

type ActiveSSHConnectionsListener = (
  connections: ActiveSSHConnectionInfo[],
) => void;

export interface SSHConnectionHealthEvent {
  connectionId: string;
  status: ConnectionHealthStatus;
  failureCount: number;
}

type SSHConnectionHealthListener = (event: SSHConnectionHealthEvent) => void;

export interface TunnelOptions {
  localHost?: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  sourceHost?: string;
  sourcePort?: number;
}

export interface TunnelResult {
  localPort?: number;
  tunnelId?: string;
}

interface SSHConnectionContext {
  id: string;
  connection: SSH2Client;
  credentials: SSHCredentials;
  activeTunnels: Map<string, net.Server>;
  tunnelPorts: Map<string, number>;
  tunnelConnections: Map<string, Set<net.Socket>>;
  tunnelCounter: number;
  isDisconnecting: boolean;
  healthFailureCount: number;
  healthStatus: ConnectionHealthStatus;
  healthTimer: ReturnType<typeof setInterval> | null;
  healthCheckInFlight: boolean;
  healthCheckToken: number;
}

interface PendingSSHConnectionContext {
  clients: Set<SSH2Client>;
  isCanceled: boolean;
  resolve?: (value: Response<{ connectionId: string }>) => void;
}

export interface SSHConnectionClosedEvent {
  connectionId: string;
  host: string;
  port: string;
  username: string;
  reason: string;
}

type SSHConnectionClosedListener = (event: SSHConnectionClosedEvent) => void;

const SSH_CONNECT_TIMEOUT = 10000;
const SSH_KEEPALIVE_INTERVAL = 3000;
const SSH_KEEPALIVE_COUNT_MAX = 10;
const HEALTH_CHECK_INTERVAL = 3000;
const HEALTH_CHECK_TIMEOUT = 20000;
const UNSTABLE_FAILURE_COUNT = 3;

export class SSHAuthManager {
  private connections: Map<string, SSHConnectionContext> = new Map();

  private pendingConnections: Map<string, PendingSSHConnectionContext> =
    new Map();

  private connectionClosedListeners = new Set<SSHConnectionClosedListener>();

  private activeConnectionsListeners = new Set<ActiveSSHConnectionsListener>();

  private connectionHealthListeners = new Set<SSHConnectionHealthListener>();

  private static attachPasswordAuthHandler(
    connection: SSH2Client,
    password: string,
  ): void {
    connection.on(
      'keyboard-interactive',
      (_name, _instructions, _lang, prompts, finish) => {
        finish(prompts.map(() => password));
      },
    );
  }

  private static safelyEndClient(client: SSH2Client): void {
    client.on('error', (error) => {
      log.warn('关闭 SSH 客户端时忽略连接错误:', error);
    });
    client.end();
  }

  public async authenticateSSH(
    credentials: SSHCredentials,
    connectionId?: string,
  ): Promise<Response<{ connectionId: string }>> {
    const id = connectionId || SSHAuthManager.createConnectionId(credentials);
    if (this.connections.has(id)) {
      this.removeConnection(id);
    }
    const pendingContext: PendingSSHConnectionContext = {
      clients: new Set(),
      isCanceled: false,
    };
    this.pendingConnections.set(id, pendingContext);

    return new Promise((resolve) => {
      const resolveConnection = (value: Response<{ connectionId: string }>) => {
        this.pendingConnections.delete(id);
        resolve(value);
      };
      pendingContext.resolve = resolveConnection;
      if (credentials.useJumpHost) {
        this.connectThroughJumpHost(id, credentials, resolveConnection);
      } else {
        this.connectDirectly(id, credentials, resolveConnection);
      }
    });
  }

  public cancelAuthentication(connectionId: string): Response<null> {
    const pendingContext = this.pendingConnections.get(connectionId);
    if (!pendingContext) {
      this.removeConnection(connectionId);
      return new SuccessResponse(null);
    }

    pendingContext.isCanceled = true;
    pendingContext.clients.forEach((client) => {
      SSHAuthManager.safelyEndClient(client);
    });
    pendingContext.resolve?.(new ErrorResponse('连接已取消'));
    this.pendingConnections.delete(connectionId);
    return new SuccessResponse(null);
  }

  private trackPendingClient(
    connectionId: string,
    client: SSH2Client,
  ): boolean {
    const pendingContext = this.pendingConnections.get(connectionId);
    if (!pendingContext || pendingContext.isCanceled) {
      SSHAuthManager.safelyEndClient(client);
      return false;
    }

    pendingContext.clients.add(client);
    return true;
  }

  private isAuthenticationCanceled(connectionId: string): boolean {
    const pendingContext = this.pendingConnections.get(connectionId);
    return !pendingContext || pendingContext.isCanceled;
  }

  private static createConnectionId(credentials: SSHCredentials): string {
    const safeHost = credentials.host.replace(/[^a-zA-Z0-9.-]/g, '-');
    return `${safeHost}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private connectThroughJumpHost(
    connectionId: string,
    credentials: SSHCredentials,
    resolve: (value: Response<{ connectionId: string }>) => void,
  ): void {
    log.info(
      `Connecting to jump host: ${credentials.jumpUsername}@${credentials.jumpHost}:${credentials.jumpPort || '22'}`,
    );
    const jumpConn = new Client();
    const targetConn = new Client();
    if (!this.trackPendingClient(connectionId, jumpConn)) return;
    if (!this.trackPendingClient(connectionId, targetConn)) return;
    SSHAuthManager.attachPasswordAuthHandler(targetConn, credentials.password);

    jumpConn.on('ready', () => {
      if (this.isAuthenticationCanceled(connectionId)) {
        jumpConn.end();
        return;
      }
      log.info(`Jump host connected: ${credentials.jumpHost}`);
      jumpConn.forwardOut(
        '127.0.0.1',
        0,
        credentials.host,
        parseInt(credentials.port, 10),
        (err, stream) => {
          if (this.isAuthenticationCanceled(connectionId)) {
            stream?.destroy();
            jumpConn.end();
            return;
          }
          if (err) {
            jumpConn.end();
            resolve(
              new ErrorResponse(`Jump host forwarding failed: ${err.message}`),
            );
            return;
          }

          targetConn.on('ready', () => {
            if (this.isAuthenticationCanceled(connectionId)) {
              targetConn.end();
              jumpConn.end();
              return;
            }
            log.info(`Target host connected successfully: ${connectionId}`);
            this.registerConnection(connectionId, targetConn, credentials);
            targetConn.on('close', () => jumpConn.end());
            resolve(new SuccessResponse({ connectionId }));
          });

          targetConn.on('error', (targetError) => {
            jumpConn.end();
            resolve(
              new ErrorResponse(
                `Target host connection failed: ${targetError.message}`,
              ),
            );
          });

          targetConn.connect({
            sock: stream,
            username: credentials.username,
            password: credentials.password,
            tryKeyboard: true,
            readyTimeout: SSH_CONNECT_TIMEOUT,
            keepaliveInterval: SSH_KEEPALIVE_INTERVAL,
            keepaliveCountMax: SSH_KEEPALIVE_COUNT_MAX,
          });
        },
      );
    });

    jumpConn.on('error', (err) => {
      resolve(new ErrorResponse(`Jump host connection failed: ${err.message}`));
    });

    const jumpOptions: any = {
      host: credentials.jumpHost,
      port: parseInt(credentials.jumpPort || '22', 10),
      username: credentials.jumpUsername,
      readyTimeout: SSH_CONNECT_TIMEOUT,
      keepaliveInterval: SSH_KEEPALIVE_INTERVAL,
      keepaliveCountMax: SSH_KEEPALIVE_COUNT_MAX,
    };

    if (credentials.jumpAuthType === 'password') {
      jumpOptions.password = credentials.jumpPassword;
      jumpConn.connect(jumpOptions);
      return;
    }

    try {
      const keyPath =
        credentials.jumpKeyFilePath?.replace(/^~/, os.homedir()) ||
        path.join(os.homedir(), '.ssh', 'id_rsa');
      if (!fs.existsSync(keyPath)) {
        resolve(new ErrorResponse(`私钥文件不存在: ${keyPath}`));
        return;
      }
      jumpOptions.privateKey = fs.readFileSync(keyPath);
      jumpConn.connect(jumpOptions);
    } catch (error) {
      resolve(new ErrorResponse(`读取私钥失败: ${error.message}`));
    }
  }

  private connectDirectly(
    connectionId: string,
    credentials: SSHCredentials,
    resolve: (value: Response<{ connectionId: string }>) => void,
  ): void {
    const conn = new Client();
    if (!this.trackPendingClient(connectionId, conn)) return;
    SSHAuthManager.attachPasswordAuthHandler(conn, credentials.password);
    conn.on('ready', () => {
      if (this.isAuthenticationCanceled(connectionId)) {
        conn.end();
        return;
      }
      log.info(`SSH connection successful: ${connectionId}`);
      this.registerConnection(connectionId, conn, credentials);
      resolve(new SuccessResponse({ connectionId }));
    });

    conn.on('error', (err) => {
      resolve(new ErrorResponse(`连接失败: ${err.message}`));
    });

    conn.connect({
      host: credentials.host,
      port: parseInt(credentials.port, 10),
      username: credentials.username,
      password: credentials.password,
      tryKeyboard: true,
      readyTimeout: SSH_CONNECT_TIMEOUT,
      keepaliveInterval: SSH_KEEPALIVE_INTERVAL,
      keepaliveCountMax: SSH_KEEPALIVE_COUNT_MAX,
    });
  }

  private registerConnection(
    connectionId: string,
    connection: SSH2Client,
    credentials: SSHCredentials,
  ) {
    const context: SSHConnectionContext = {
      id: connectionId,
      connection,
      credentials,
      activeTunnels: new Map(),
      tunnelPorts: new Map(),
      tunnelConnections: new Map(),
      tunnelCounter: 0,
      isDisconnecting: false,
      healthFailureCount: 0,
      healthStatus: 'online',
      healthTimer: null,
      healthCheckInFlight: false,
      healthCheckToken: 0,
    };

    this.connections.set(connectionId, context);
    this.startHealthCheck(context);
    this.logActiveConnections('register');
    this.notifyActiveConnectionsChanged();
    connection.on('error', (err) => this.handleSSHError(connectionId, err));
    connection.on('close', () => this.handleConnectionClose(connectionId));
    connection.on('end', () => this.handleConnectionClose(connectionId));
  }

  private logActiveConnections(reason: string): void {
    const activeConnections = Array.from(this.connections.entries()).map(
      ([connectionId, context]) => {
        const { host, port, username, useJumpHost, jumpHost, jumpPort } =
          context.credentials;
        return {
          connectionId,
          target: `${username}@${host}:${port}`,
          jumpHost: useJumpHost ? `${jumpHost}:${jumpPort || '22'}` : null,
        };
      },
    );

    log.info('Active SSH connections:', {
      reason,
      count: activeConnections.length,
      connections: activeConnections,
    });
  }

  public onConnectionClosed(listener: SSHConnectionClosedListener): () => void {
    this.connectionClosedListeners.add(listener);
    return () => this.connectionClosedListeners.delete(listener);
  }

  public onActiveConnectionsChanged(
    listener: ActiveSSHConnectionsListener,
  ): () => void {
    this.activeConnectionsListeners.add(listener);
    return () => this.activeConnectionsListeners.delete(listener);
  }

  public onConnectionHealthChanged(
    listener: SSHConnectionHealthListener,
  ): () => void {
    this.connectionHealthListeners.add(listener);
    return () => this.connectionHealthListeners.delete(listener);
  }

  private notifyActiveConnectionsChanged(): void {
    const activeConnections = this.getActiveConnections();
    this.activeConnectionsListeners.forEach((listener) => {
      listener(activeConnections);
    });
  }

  private notifyConnectionHealthChanged(context: SSHConnectionContext): void {
    const event = {
      connectionId: context.id,
      status: context.healthStatus,
      failureCount: context.healthFailureCount,
    };
    this.connectionHealthListeners.forEach((listener) => listener(event));
    this.notifyActiveConnectionsChanged();
  }

  private handleSSHError(connectionId: string, err: Error) {
    log.error(`SSH connection error for ${connectionId}:`, err);
    this.notifyConnectionClosed(connectionId, err.message || '连接异常');
    this.removeConnection(connectionId);
  }

  private handleConnectionClose(connectionId: string) {
    log.info(`SSH connection closed for: ${connectionId}`);
    this.notifyConnectionClosed(connectionId, '连接已断开');
    this.removeConnection(connectionId);
  }

  private notifyConnectionClosed(connectionId: string, reason: string) {
    const context = this.connections.get(connectionId);
    if (!context || context.isDisconnecting) {
      return;
    }

    const { host, port, username } = context.credentials;
    const event = { connectionId, host, port, username, reason };
    this.connectionClosedListeners.forEach((listener) => listener(event));
  }

  private startHealthCheck(context: SSHConnectionContext): void {
    context.healthTimer = setInterval(() => {
      this.checkConnectionHealth(context.id);
    }, HEALTH_CHECK_INTERVAL);
  }

  private checkConnectionHealth(connectionId: string): void {
    const context = this.connections.get(connectionId);
    if (!context || context.isDisconnecting || context.healthCheckInFlight) {
      return;
    }

    context.healthCheckInFlight = true;
    context.healthCheckToken += 1;
    const { healthCheckToken } = context;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      this.handleHealthFailure(
        connectionId,
        healthCheckToken,
        new Error('健康检测超时'),
      );
    }, HEALTH_CHECK_TIMEOUT);

    context.connection.exec('true', (err, stream) => {
      if (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this.handleHealthFailure(connectionId, healthCheckToken, err);
        }
        return;
      }

      stream
        .on('close', (code) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (code === 0) {
            this.handleHealthSuccess(connectionId, healthCheckToken);
            return;
          }
          this.handleHealthFailure(
            connectionId,
            healthCheckToken,
            new Error(`健康检测命令退出码: ${code}`),
          );
        })
        .on('error', (streamError) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this.handleHealthFailure(connectionId, healthCheckToken, streamError);
        });
    });
  }

  private handleHealthSuccess(
    connectionId: string,
    healthCheckToken: number,
  ): void {
    const context = this.connections.get(connectionId);
    if (
      !context ||
      context.isDisconnecting ||
      context.healthCheckToken !== healthCheckToken
    ) {
      return;
    }

    const shouldNotify = context.healthStatus !== 'online';
    context.healthCheckInFlight = false;
    context.healthFailureCount = 0;
    context.healthStatus = 'online';
    if (shouldNotify) {
      log.info('连接健康检测恢复正常:', { connectionId });
      this.notifyConnectionHealthChanged(context);
    }
  }

  private handleHealthFailure(
    connectionId: string,
    healthCheckToken: number,
    error: Error,
  ): void {
    const context = this.connections.get(connectionId);
    if (
      !context ||
      context.isDisconnecting ||
      context.healthCheckToken !== healthCheckToken
    ) {
      return;
    }

    context.healthCheckInFlight = false;
    context.healthFailureCount += 1;

    if (
      context.healthFailureCount >= UNSTABLE_FAILURE_COUNT &&
      context.healthStatus !== 'unstable'
    ) {
      context.healthStatus = 'unstable';
      log.warn('连接健康检测进入不稳定状态:', {
        connectionId,
        failureCount: context.healthFailureCount,
        error: error.message,
      });
      this.notifyConnectionHealthChanged(context);
    }
  }

  private requireContext(connectionId: string): SSHConnectionContext {
    const context = this.connections.get(connectionId);
    if (!context) {
      throw new Error(`连接未建立: ${connectionId}`);
    }
    return context;
  }

  public getPublicCredentials(
    connectionId: string,
  ): PublicSSHCredentials | null {
    const context = this.connections.get(connectionId);
    if (!context) {
      return null;
    }

    const {
      host,
      port,
      username,
      useJumpHost,
      jumpHost,
      jumpPort,
      jumpUsername,
      jumpAuthType,
      jumpKeyFilePath,
    } = context.credentials;

    return {
      host,
      port,
      username,
      useJumpHost,
      jumpHost,
      jumpPort,
      jumpUsername,
      jumpAuthType,
      jumpKeyFilePath,
    };
  }

  public getActiveConnections(): ActiveSSHConnectionInfo[] {
    return Array.from(this.connections.keys())
      .map((connectionId) => {
        const context = this.connections.get(connectionId);
        const credentials = this.getPublicCredentials(connectionId);
        if (!context || !credentials) return null;
        return {
          connectionId,
          credentials,
          healthStatus: context.healthStatus,
        };
      })
      .filter(Boolean) as ActiveSSHConnectionInfo[];
  }

  public getConnection(connectionId: string): SSH2Client {
    return this.requireContext(connectionId).connection;
  }

  public removeConnection(connectionId: string): void {
    const context = this.connections.get(connectionId);
    if (!context || context.isDisconnecting) {
      return;
    }

    context.isDisconnecting = true;
    if (context.healthTimer) {
      clearInterval(context.healthTimer);
      context.healthTimer = null;
    }
    this.closeAllTunnels(connectionId);
    context.connection.removeAllListeners();
    context.connection.end();
    this.connections.delete(connectionId);
    log.info(`SSH resources cleaned up: ${connectionId}`);
    this.logActiveConnections('remove');
    this.notifyActiveConnectionsChanged();
  }

  public removeAllConnections(): void {
    Array.from(this.connections.keys()).forEach((connectionId) => {
      this.removeConnection(connectionId);
    });
  }

  public executeCommand(
    connectionId: string,
    command: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const { connection } = this.requireContext(connectionId);
      let output = '';
      connection.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        stream
          .on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`Command failed with exit code: ${code}`));
              return;
            }
            resolve(output);
          })
          .on('data', (data) => {
            output += data.toString();
          })
          .stderr.on('data', (data) => {
            log.error(`SSH command stderr: ${data}`);
          });
      });
    });
  }

  public executeCommandWithStream(
    connectionId: string,
    command: string,
    onData: (data: string) => void,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const { connection } = this.requireContext(connectionId);
      connection.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        stream
          .on('close', (code: number) => {
            resolve(code);
          })
          .on('data', (data: Buffer) => {
            onData(data.toString('utf-8'));
          })
          .stderr.on('data', (data: Buffer) => {
            onData(data.toString('utf-8'));
          });
      });
    });
  }

  public executePtyCommand(
    connectionId: string,
    command: string,
    onData: (data: string) => void,
    onError?: (error: string) => void,
  ): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const { connection } = this.requireContext(connectionId);
      connection.exec(command, { pty: true }, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        const stopCommand = () => {
          if (stream && !stream.destroyed) {
            stream.write('\x03');
            stream.close();
          }
        };
        stream.on('data', (data) => onData(data.toString()));
        stream.stderr.on('data', (data) => {
          const errorMsg = data.toString();
          log.error(`SSH command stderr: ${errorMsg}`);
          onError?.(errorMsg);
        });
        resolve(stopCommand);
      });
    });
  }

  public async createTunnel(
    connectionId: string,
    options: TunnelOptions,
  ): Promise<Response<TunnelResult>> {
    return new Promise((resolve) => {
      const context = this.requireContext(connectionId);
      let tunnelId: string | null = null;
      const trackedSockets = new Set<net.Socket>();

      const server = net.createServer((clientSocket) => {
        trackedSockets.add(clientSocket);
        let tunnelStream: ClientChannel | null = null;
        const safeCloseStream = () => {
          if (!tunnelStream) return;
          if (typeof tunnelStream.close === 'function') tunnelStream.close();
          else tunnelStream.end();
          tunnelStream = null;
        };

        clientSocket.on('error', (socketError) => {
          log.warn(`Tunnel client socket error: ${socketError.message}`);
          safeCloseStream();
          if (!clientSocket.destroyed) clientSocket.destroy();
        });

        clientSocket.on('close', () => {
          safeCloseStream();
          trackedSockets.delete(clientSocket);
        });

        context.connection.forwardOut(
          options.sourceHost || '127.0.0.1',
          options.sourcePort || 0,
          options.remoteHost,
          options.remotePort,
          (err, stream) => {
            if (err) {
              safeCloseStream();
              if (!clientSocket.destroyed) clientSocket.destroy();
              return;
            }

            tunnelStream = stream;
            stream.on('error', (streamError) => {
              safeCloseStream();
              clientSocket.destroy(streamError);
            });
            stream.on('close', () => {
              safeCloseStream();
              if (!clientSocket.destroyed) clientSocket.destroy();
            });
            clientSocket.pipe(stream).pipe(clientSocket);
          },
        );
      });

      server.listen(options.localPort, options.localHost, () => {
        const { port } = server.address() as net.AddressInfo;
        context.tunnelCounter += 1;
        tunnelId = `${connectionId}_tunnel_${context.tunnelCounter}`;
        context.activeTunnels.set(tunnelId, server);
        context.tunnelPorts.set(tunnelId, port);
        context.tunnelConnections.set(tunnelId, trackedSockets);
        resolve(new SuccessResponse({ localPort: port, tunnelId }));
      });

      server.on('error', (err) => {
        resolve(new ErrorResponse(`Tunnel server error: ${err.message}`));
      });
    });
  }

  public closeTunnel(
    connectionId: string,
    tunnelId: string | null,
  ): Response<boolean> {
    if (!tunnelId) return new SuccessResponse(true);

    const context = this.connections.get(connectionId);
    if (!context) return new SuccessResponse(true);

    const server = context.activeTunnels.get(tunnelId);
    if (!server) return new SuccessResponse(true);
    const sockets = context.tunnelConnections.get(tunnelId);
    sockets?.forEach((socket) => socket.destroy());
    try {
      server.close();
    } catch (error) {
      log.warn(`关闭隧道服务失败:`, error);
    }
    context.activeTunnels.delete(tunnelId);
    context.tunnelPorts.delete(tunnelId);
    context.tunnelConnections.delete(tunnelId);
    return new SuccessResponse(true);
  }

  public getTunnel(
    connectionId: string,
    tunnelId: string,
  ): { localPort: number } | null {
    const context = this.connections.get(connectionId);
    const localPort = context?.tunnelPorts.get(tunnelId);
    if (!localPort) return null;
    return { localPort };
  }

  public closeAllTunnels(connectionId: string): void {
    const context = this.connections.get(connectionId);
    if (!context) return;
    context.activeTunnels.forEach((server, tunnelId) => {
      const sockets = context.tunnelConnections.get(tunnelId);
      sockets?.forEach((socket) => socket.destroy());
      server.close();
    });
    context.activeTunnels.clear();
    context.tunnelPorts.clear();
    context.tunnelConnections.clear();
  }
}

export default new SSHAuthManager();
