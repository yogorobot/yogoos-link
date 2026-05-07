import type { ConnectionFormValues, SshConnectionRecord } from './types';

const CONNECTIONS_KEY = 'yolink:ssh-connections';

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

export const loadConnections = (): SshConnectionRecord[] => {
  const stored = localStorage.getItem(CONNECTIONS_KEY);
  if (!stored) return [];
  return dedupeConnections(JSON.parse(stored) as SshConnectionRecord[]);
};

export const saveConnections = (records: SshConnectionRecord[]) => {
  localStorage.setItem(
    CONNECTIONS_KEY,
    JSON.stringify(dedupeConnections(records)),
  );
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
