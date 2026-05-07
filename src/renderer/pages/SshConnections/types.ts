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
}
