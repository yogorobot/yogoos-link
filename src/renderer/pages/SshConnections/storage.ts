import type { ConnectionFormValues, SshConnectionRecord } from './types';

const getConnectionKey = (record: SshConnectionRecord) =>
  record.host.trim().toLowerCase();

export const dedupeConnections = (
  records: SshConnectionRecord[],
): SshConnectionRecord[] => {
  const recordMap = new Map<string, SshConnectionRecord>();

  records.forEach((record) => {
    const key = getConnectionKey(record);
    if (!key) return;

    const normalizedRecord = {
      ...record,
      host: record.host.trim(),
      name: record.host.trim(),
    };
    const existingRecord = recordMap.get(key);
    if (
      !existingRecord ||
      normalizedRecord.updatedAt >= existingRecord.updatedAt
    ) {
      recordMap.set(key, normalizedRecord);
    }
  });

  return Array.from(recordMap.values()).sort(
    (previousRecord, nextRecord) =>
      nextRecord.updatedAt - previousRecord.updatedAt,
  );
};

export const createDefaultFormValues = (): ConnectionFormValues => ({
  host: '',
  port: '22',
  username: 'yogo',
  password: '',
  useJumpHost: false,
  jumpHost: '',
  jumpPort: '22',
  jumpUsername: '',
  jumpAuthType: 'key',
  jumpPassword: '',
  jumpKeyFilePath: '~/.ssh/id_rsa',
});

export const loadConnections = async (): Promise<SshConnectionRecord[]> => {
  const result = await window.electron.ipcRenderer.invoke(
    'ssh:load-connection-records',
  );
  if (!result?.success) {
    throw new Error(result?.error || '读取连接历史失败');
  }

  return dedupeConnections((result.data || []) as SshConnectionRecord[]);
};

export const saveConnections = async (records: SshConnectionRecord[]) => {
  const result = await window.electron.ipcRenderer.invoke(
    'ssh:save-connection-records',
    dedupeConnections(records),
  );
  if (!result?.success) {
    throw new Error(result?.error || '保存连接历史失败');
  }
};

export const toFormValues = (
  record: SshConnectionRecord,
): ConnectionFormValues => ({
  host: record.host,
  port: record.port,
  username: record.username,
  password: '',
  useJumpHost: record.useJumpHost,
  jumpHost: record.jumpHost,
  jumpPort: record.jumpPort,
  jumpUsername: record.jumpUsername,
  jumpAuthType: record.jumpAuthType,
  jumpPassword: '',
  jumpKeyFilePath: record.jumpKeyFilePath,
});

export const toRecord = (
  values: ConnectionFormValues,
  previous?: SshConnectionRecord,
): SshConnectionRecord => {
  const now = Date.now();
  return {
    id: previous?.id || `ssh_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: values.host.trim(),
    host: values.host.trim(),
    port: values.port.trim(),
    username: values.username.trim(),
    useJumpHost: values.useJumpHost,
    jumpHost: values.jumpHost.trim(),
    jumpPort: values.jumpPort.trim() || '22',
    jumpUsername: values.jumpUsername.trim(),
    jumpAuthType: values.jumpAuthType,
    jumpKeyFilePath: values.jumpKeyFilePath.trim(),
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
};
