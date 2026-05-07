import type { ConnectionFormValues, SSHCredentials } from './types';

export type ConnectionFormErrors = Partial<
  Record<keyof ConnectionFormValues, string>
>;

const isBlank = (value?: string) => !value?.trim();

const isValidPort = (value?: string) => {
  if (isBlank(value) || !/^\d+$/.test(value || '')) return false;
  const port = Number.parseInt(value || '', 10);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
};

export const validateConnection = (
  values: ConnectionFormValues,
): string | null => {
  if (isBlank(values.host)) return '请填写主机地址';
  if (!isValidPort(values.port)) return '请输入有效的端口';
  if (isBlank(values.username)) return '请填写用户名';
  if (isBlank(values.password)) return '请填写连接密码';

  if (!values.useJumpHost) return null;
  if (isBlank(values.jumpHost)) return '启用跳板机后，请填写跳板机地址';
  if (!isValidPort(values.jumpPort || '22')) return '请输入有效的跳板机端口';
  if (isBlank(values.jumpUsername)) return '启用跳板机后，请填写跳板机用户名';
  if (values.jumpAuthType === 'password' && isBlank(values.jumpPassword)) {
    return '请选择密码认证后填写跳板机密码';
  }
  if (values.jumpAuthType === 'key' && isBlank(values.jumpKeyFilePath)) {
    return '请选择跳板机私钥文件';
  }
  return null;
};

export const validateConnectionFields = (
  values: ConnectionFormValues,
  options: { requirePassword?: boolean } = {},
): ConnectionFormErrors => {
  const { requirePassword = true } = options;
  const errors: ConnectionFormErrors = {};

  if (isBlank(values.host)) errors.host = '请填写主机地址';
  if (!isValidPort(values.port)) errors.port = '请输入有效的端口';
  if (isBlank(values.username)) errors.username = '请填写用户名';
  if (requirePassword && isBlank(values.password)) {
    errors.password = '请填写连接密码';
  }

  if (!values.useJumpHost) return errors;

  if (isBlank(values.jumpHost)) errors.jumpHost = '请填写跳板机地址';
  if (!isValidPort(values.jumpPort || '22')) {
    errors.jumpPort = '请输入有效的跳板机端口';
  }
  if (isBlank(values.jumpUsername)) {
    errors.jumpUsername = '请填写跳板机用户名';
  }
  if (values.jumpAuthType === 'password' && isBlank(values.jumpPassword)) {
    errors.jumpPassword = '请填写跳板机密码';
  }
  if (values.jumpAuthType === 'key' && isBlank(values.jumpKeyFilePath)) {
    errors.jumpKeyFilePath = '请选择跳板机私钥文件';
  }

  return errors;
};

export const getFirstConnectionError = (
  errors: ConnectionFormErrors,
): string | null => Object.values(errors)[0] || null;

export const toCredentials = (
  values: ConnectionFormValues,
): SSHCredentials => ({
  host: values.host.trim(),
  port: values.port.trim(),
  username: values.username.trim(),
  password: values.password,
  useJumpHost: values.useJumpHost,
  jumpHost: values.jumpHost.trim(),
  jumpPort: values.jumpPort.trim() || '22',
  jumpUsername: values.jumpUsername.trim(),
  jumpAuthType: values.jumpAuthType,
  jumpPassword: values.jumpPassword,
  jumpKeyFilePath: values.jumpKeyFilePath.trim(),
});
