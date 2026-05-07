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

export class SSHAuthManager {
  private connections: Map<string, SSHConnectionContext> = new Map();

  private connectionClosedListeners = new Set<SSHConnectionClosedListener>();

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

  public async authenticateSSH(
    credentials: SSHCredentials,
    connectionId?: string,
  ): Promise<Response<{ connectionId: string }>> {
    const id = connectionId || SSHAuthManager.createConnectionId(credentials);
    if (this.connections.has(id)) {
      this.removeConnection(id);
    }

    return new Promise((resolve) => {
      if (credentials.useJumpHost) {
        this.connectThroughJumpHost(id, credentials, resolve);
      } else {
        this.connectDirectly(id, credentials, resolve);
      }
    });
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
    SSHAuthManager.attachPasswordAuthHandler(targetConn, credentials.password);

    jumpConn.on('ready', () => {
      log.info(`Jump host connected: ${credentials.jumpHost}`);
      jumpConn.forwardOut(
        '127.0.0.1',
        0,
        credentials.host,
        parseInt(credentials.port, 10),
        (err, stream) => {
          if (err) {
            jumpConn.end();
            resolve(
              new ErrorResponse(`Jump host forwarding failed: ${err.message}`),
            );
            return;
          }

          targetConn.on('ready', () => {
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
    SSHAuthManager.attachPasswordAuthHandler(conn, credentials.password);
    conn.on('ready', () => {
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
    };

    this.connections.set(connectionId, context);
    connection.on('error', (err) => this.handleSSHError(connectionId, err));
    connection.on('close', () => this.handleConnectionClose(connectionId));
    connection.on('end', () => this.handleConnectionClose(connectionId));
  }

  public onConnectionClosed(listener: SSHConnectionClosedListener): () => void {
    this.connectionClosedListeners.add(listener);
    return () => this.connectionClosedListeners.delete(listener);
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

  public getConnection(connectionId: string): SSH2Client {
    return this.requireContext(connectionId).connection;
  }

  public removeConnection(connectionId: string): void {
    const context = this.connections.get(connectionId);
    if (!context || context.isDisconnecting) {
      return;
    }

    context.isDisconnecting = true;
    this.closeAllTunnels(connectionId);
    context.connection.removeAllListeners();
    context.connection.end();
    this.connections.delete(connectionId);
    log.info(`SSH resources cleaned up: ${connectionId}`);
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
