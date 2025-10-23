import { Client } from 'ssh2';
import log from 'electron-log';
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
import { windowManager } from '.';

export interface SSHCredentials {
  host: string;
  port: string;
  username: string;
  password: string;
  useJumpHost?: boolean;
  jumpHost?: string;
  jumpPort?: string;
  jumpUsername?: string;
  jumpKeyFilePath?: string;
}

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

export class SSHAuthManager {
  public sshConnection: Client = null;
  public sshCredentials: SSHCredentials = null;
  private isDisconnecting = false;

  private activeTunnels: Map<string, net.Server> = new Map();
  private tunnelCounter = 0;
  private tunnelStats: Map<
    string,
    { connectionCount: number; createdAt: Date }
  > = new Map();

  public async authenticateSSH(
    credentials: SSHCredentials,
  ): Promise<Response<string>> {
    this.isDisconnecting = false; // Reset flag on new connection attempt
    return new Promise((resolve) => {
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
    log.info(
      `Connecting to jump host: ${credentials.jumpUsername}@${credentials.jumpHost}:${credentials.jumpPort || '22'}`,
    );
    const jumpConn = new Client();
    const targetConn = new Client();

    jumpConn.on('ready', () => {
      log.info(`Jump host connected: ${credentials.jumpHost}`);
      jumpConn.forwardOut(
        '127.0.0.1',
        0,
        credentials.host,
        parseInt(credentials.port),
        (err, stream) => {
          if (err) {
            log.error('Jump host forwarding failed:', err);
            jumpConn.end();
            return resolve(
              new ErrorResponse(`Jump host forwarding failed: ${err.message}`),
            );
          }

          const targetOptions: any = {
            sock: stream,
            username: credentials.username,
            password: credentials.password,
            readyTimeout: 10000,
            keepaliveInterval: 3000,
            keepaliveCountMax: 2,
          };

          targetConn.on('ready', () => {
            log.info('Target host connected successfully.');
            this.sshConnection = targetConn;
            this.sshCredentials = credentials;
            this.setupConnectionHandlers();
            targetConn.on('close', () => jumpConn.end());
            resolve(new SuccessResponse(encodeBase64(credentials)));
          });

          targetConn.on('error', (err) => {
            log.error('Target host connection failed:', err);
            jumpConn.end();
            resolve(
              new ErrorResponse(
                `Target host connection failed: ${err.message}`,
              ),
            );
          });

          targetConn.connect(targetOptions);
        },
      );
    });

    jumpConn.on('error', (err) => {
      log.error('Jump host connection failed:', err);
      resolve(new ErrorResponse(`Jump host connection failed: ${err.message}`));
    });

    const jumpOptions: any = {
      host: credentials.jumpHost,
      port: parseInt(credentials.jumpPort || '22'),
      username: credentials.jumpUsername,
      readyTimeout: 10000,
      keepaliveInterval: 3000,
      keepaliveCountMax: 2,
    };

    try {
      const keyPath =
        credentials.jumpKeyFilePath?.replace(/^~/, os.homedir()) ||
        path.join(os.homedir(), '.ssh', 'id_rsa');
      if (!fs.existsSync(keyPath)) {
        return resolve(new ErrorResponse(`SSH key file not found: ${keyPath}`));
      }
      jumpOptions.privateKey = fs.readFileSync(keyPath);
      jumpConn.connect(jumpOptions);
    } catch (error) {
      resolve(new ErrorResponse(`Failed to read SSH key: ${error.message}`));
    }
  }

  private connectDirectly(
    credentials: SSHCredentials,
    resolve: (value: Response<string>) => void,
  ): void {
    const conn = new Client();
    conn.on('ready', () => {
      log.info('SSH connection successful.');
      this.sshConnection = conn;
      this.sshCredentials = credentials;
      this.setupConnectionHandlers();
      resolve(new SuccessResponse(encodeBase64(credentials)));
    });

    conn.on('error', (err) => {
      log.error('SSH connection failed:', err);
      resolve(new ErrorResponse(`SSH connection failed: ${err.message}`));
    });

    conn.connect({
      host: credentials.host,
      port: parseInt(credentials.port),
      username: credentials.username,
      password: credentials.password,
      readyTimeout: 10000,
      keepaliveInterval: 3000,
      keepaliveCountMax: 2,
    });
  }

  private handleSSHError(err: Error) {
    log.error('SSH connection error, initiating disconnect:', err);
    this.removeConnection();
  }

  private handleConnectionClose() {
    log.info(
      `SSH connection closed for: ${this.sshCredentials?.host}, initiating disconnect.`,
    );
    this.removeConnection();
  }

  private setupConnectionHandlers() {
    if (!this.sshConnection) return;
    // Use .bind(this) to ensure 'this' context is correct
    this.sshConnection.on('error', this.handleSSHError.bind(this));
    this.sshConnection.on('close', this.handleConnectionClose.bind(this));
  }

  public removeConnection(): void {
    if (this.isDisconnecting) {
      log.warn('Disconnection process already in progress.');
      return;
    }
    this.isDisconnecting = true;
    log.info('Starting disconnection process...');

    this.closeAllTunnels();

    if (this.sshConnection) {
      // Remove all listeners to prevent handleConnectionClose from being called again
      this.sshConnection.removeAllListeners();
      this.sshConnection.end();
      this.sshConnection = null;
    }

    this.sshCredentials = null;
    log.info('SSH resources cleaned up.');

    // Dynamically require to avoid circular dependencies
    // Use setImmediate to allow the current call stack to clear before creating a new window.
    setImmediate(() => {
      windowManager.createLoginWindow();
    });
  }

  public executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.sshConnection) {
        return reject(new Error('SSH connection not established.'));
      }
      let output = '';
      this.sshConnection.exec(command, (err, stream) => {
        if (err) return reject(err);
        stream
          .on('close', (code) => {
            if (code !== 0)
              return reject(
                new Error(`Command failed with exit code: ${code}`),
              );
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
    command: string,
    onData: (data: string) => void,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.sshConnection) {
        return reject(new Error('SSH connection not established.'));
      }
      this.sshConnection.exec(command, (err, stream) => {
        if (err) {
          return reject(err);
        }
        stream
          .on('close', (code: number) => {
            log.info(`Command stream closed with code: ${code}`);
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
    command: string,
    onData: (data: string) => void,
    onError?: (error: string) => void,
  ): Promise<() => void> {
    return new Promise((resolve, reject) => {
      if (!this.sshConnection) {
        return reject(new Error('SSH connection not established.'));
      }
      this.sshConnection.exec(command, { pty: true }, (err, stream) => {
        if (err) return reject(err);
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
    options: TunnelOptions,
  ): Promise<Response<TunnelResult>> {
    return new Promise((resolve) => {
      if (!this.sshConnection) {
        return resolve(new ErrorResponse('SSH connection not established.'));
      }
      const server = net.createServer((clientSocket) => {
        this.sshConnection.forwardOut(
          options.sourceHost || '127.0.0.1',
          options.sourcePort || 0,
          options.remoteHost,
          options.remotePort,
          (err, stream) => {
            if (err) {
              log.error('Tunnel forwarding error:', err);
              clientSocket.end();
              return;
            }
            clientSocket.pipe(stream).pipe(clientSocket);
          },
        );
      });
      server.listen(options.localPort, options.localHost, () => {
        const { port } = server.address() as net.AddressInfo;
        const tunnelId = `tunnel_${++this.tunnelCounter}`;
        this.activeTunnels.set(tunnelId, server);
        resolve(new SuccessResponse({ localPort: port, tunnelId }));
      });
      server.on('error', (err) =>
        resolve(new ErrorResponse(`Tunnel server error: ${err.message}`)),
      );
    });
  }

  public closeTunnel(tunnelId: string): Response<boolean> {
    const server = this.activeTunnels.get(tunnelId);
    if (!server) return new ErrorResponse('Tunnel not found.');
    server.close();
    this.activeTunnels.delete(tunnelId);
    return new SuccessResponse(true);
  }

  public closeAllTunnels(): void {
    log.info(`Closing ${this.activeTunnels.size} active tunnels.`);
    this.activeTunnels.forEach((server, tunnelId) => {
      server.close();
      log.info(`Tunnel closed: ${tunnelId}`);
    });
    this.activeTunnels.clear();
  }
}

export default new SSHAuthManager();
