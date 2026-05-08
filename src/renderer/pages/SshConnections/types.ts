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

export type ConnectionHealthStatus = 'online' | 'unstable';

export interface SshConnectionRecord {
  id: string;
  name: string;
  host: string;
  port: string;
  username: string;
  useJumpHost: boolean;
  jumpHost: string;
  jumpPort: string;
  jumpUsername: string;
  jumpAuthType: 'password' | 'key';
  jumpKeyFilePath: string;
  createdAt: number;
  updatedAt: number;
}

export type ConnectionFormValues = Omit<
  SshConnectionRecord,
  'id' | 'name' | 'createdAt' | 'updatedAt'
> & {
  password: string;
  jumpPassword: string;
};

export interface ActiveConnection {
  connectionId: string;
  record: SshConnectionRecord;
  healthStatus: ConnectionHealthStatus;
}

export interface ActiveConnectionInfo {
  connectionId: string;
  credentials: Omit<SSHCredentials, 'password' | 'jumpPassword'>;
  healthStatus: ConnectionHealthStatus;
}

export interface ConnectionHealthEvent {
  connectionId: string;
  status: ConnectionHealthStatus;
  failureCount: number;
}

export interface PendingConnection {
  connectionId: string;
  record: SshConnectionRecord;
}
