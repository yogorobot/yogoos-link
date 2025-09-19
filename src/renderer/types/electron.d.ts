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

export interface AuthResult {
  success: boolean;
  error?: string;
  token?: string;
  connectionId?: string;
}

export interface VerifyAuthResult {
  isAuthenticated: boolean;
  token?: string;
  host?: string;
  username?: string;
  connectionId?: string;
}

export interface CreateWindowResult {
  success: boolean;
  windowId?: string;
  error?: string;
}

export interface ExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface DisconnectResult {
  success: boolean;
  error?: string;
}

export interface AuthSuccessData {
  token: string;
  host: string;
  username: string;
  connectionId: string;
}

export interface InheritAuthData {
  token: string;
  host: string;
  username: string;
  connectionId: string;
  windowType: string;
  parentAuth: boolean;
}
