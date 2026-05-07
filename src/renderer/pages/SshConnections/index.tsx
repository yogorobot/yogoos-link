import { BrowserWindowConstructorOptions } from 'electron';
import { useEffect, useState } from 'react';
import {
  useFile,
  useNotification,
  useSSH,
  useSystem,
  useWindow,
} from '../../hooks';
import { useToast } from '../../components/NotificationProvider';
import WindowTitlebar from '../../components/WindowTitlebar';
import ConnectionSidebar from './components/ConnectionSidebar';
import ConnectionWorkspacePanel from './components/ConnectionWorkspacePanel';
import SshConnectionForm from './components/SshConnectionForm';
import {
  createDefaultFormValues,
  dedupeConnections,
  loadConnections,
  saveConnections,
  toFormValues,
  toRecord,
} from './storage';
import type {
  ActiveConnection,
  ConnectionFormValues,
  SshConnectionRecord,
} from './types';
import type { ConnectionFormErrors } from './validation';
import {
  getFirstConnectionError,
  toCredentials,
  validateConnectionFields,
} from './validation';

export default function SshConnections() {
  const [records, setRecords] = useState<SshConnectionRecord[]>([]);
  const [editingRecord, setEditingRecord] =
    useState<SshConnectionRecord | null>(null);
  const [formValues, setFormValues] = useState<ConnectionFormValues>(() =>
    createDefaultFormValues(),
  );
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState<ConnectionFormErrors>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [workspaceBusyConnections, setWorkspaceBusyConnections] = useState<
    Record<string, boolean>
  >({});
  const [activeConnections, setActiveConnections] = useState<
    Record<string, ActiveConnection>
  >({});
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredRecords = normalizedSearchTerm
    ? records.filter((record) =>
        record.host.toLowerCase().includes(normalizedSearchTerm),
      )
    : records;
  const hostOptions = Array.from(new Set(records.map((record) => record.host)));
  const selectedRecord =
    records.find((record) => record.id === selectedRecordId) || null;
  const selectedConnection = selectedRecord
    ? activeConnections[selectedRecord.id] || null
    : null;
  const { authenticate, disconnect } = useSSH();
  const { createWindow } = useWindow();
  const { systemReboot } = useSystem();
  const { showOpenDialog } = useFile();
  const { showWarning } = useNotification();
  const { showError, showSuccess, showWarning: showToastWarning } = useToast();

  useEffect(() => {
    setRecords(loadConnections());
  }, []);

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'ssh:connection-closed',
      (payload) => {
        const closedConnection = payload as {
          connectionId: string;
          host: string;
          port: string;
          username: string;
          reason: string;
        };
        const message = `${closedConnection.username}@${closedConnection.host}:${closedConnection.port} 已异常断开：${closedConnection.reason}`;

        setActiveConnections((current) => {
          const nextConnections = { ...current };
          Object.entries(current).forEach(([recordId, connection]) => {
            if (connection.connectionId === closedConnection.connectionId) {
              delete nextConnections[recordId];
            }
          });
          return nextConnections;
        });
        showToastWarning(message);
        showWarning(message, '连接异常断开');
      },
    );

    return unsubscribe;
  }, [showToastWarning, showWarning]);

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'ssh:select-connection',
      (payload) => {
        const selectedConnectionPayload = payload as { connectionId: string };
        const matchedConnection = Object.entries(activeConnections).find(
          ([, connection]) =>
            connection.connectionId === selectedConnectionPayload.connectionId,
        );
        if (!matchedConnection) return;

        setSelectedRecordId(matchedConnection[0]);
        setIsSidebarOpen(false);
      },
    );

    return unsubscribe;
  }, [activeConnections]);

  const persistRecords = (nextRecords: SshConnectionRecord[]) => {
    const uniqueRecords = dedupeConnections(nextRecords);
    setRecords(uniqueRecords);
    saveConnections(uniqueRecords);
  };

  const openCreateForm = () => {
    setEditingRecord(null);
    setFormValues(createDefaultFormValues());
    setFormErrors({});
    setShowForm(true);
  };

  const saveCurrentForm = () => {
    const errors = validateConnectionFields(formValues, {
      requirePassword: false,
    });
    const validationError = getFirstConnectionError(errors);
    setFormErrors(errors);
    if (validationError) {
      showError(validationError);
      return null;
    }

    const nextRecord = toRecord(formValues, editingRecord || undefined);
    const nextRecords = editingRecord
      ? records.map((record) =>
          record.id === editingRecord.id ? nextRecord : record,
        )
      : [nextRecord, ...records];

    persistRecords(nextRecords);
    setEditingRecord(null);
    setShowForm(false);
    setFormErrors({});
    setFormValues(createDefaultFormValues());
    showSuccess('连接配置已保存');
    return nextRecord;
  };

  const connectWithValues = async (
    record: SshConnectionRecord,
    values: ConnectionFormValues,
  ) => {
    const errors = validateConnectionFields(values);
    const validationError = getFirstConnectionError(errors);
    setFormErrors(errors);
    if (validationError) {
      showError(validationError);
      return;
    }

    setConnectingId(record.id);
    try {
      const result = await authenticate(toCredentials(values));
      if (!result.success) {
        showError(result.error || '连接失败');
        return;
      }
      setActiveConnections((current) => ({
        ...current,
        [record.id]: {
          connectionId: result.data.connectionId,
          record,
        },
      }));
      setSelectedRecordId(record.id);
      showSuccess('连接成功');
      setShowForm(false);
      setFormErrors({});
      setFormValues(createDefaultFormValues());
      setEditingRecord(null);
    } catch (error) {
      showError(error instanceof Error ? error.message : '连接失败');
    } finally {
      setConnectingId(null);
    }
  };

  const selectRecord = (record: SshConnectionRecord) => {
    setSelectedRecordId(record.id);
    setIsSidebarOpen(false);
  };

  const openConnectionForm = (record: SshConnectionRecord) => {
    setIsSidebarOpen(false);
    const activeConnection = activeConnections[record.id];
    if (activeConnection) {
      setSelectedRecordId(record.id);
      return;
    }
    setEditingRecord(record);
    setFormValues(toFormValues(record));
    setFormErrors({});
    setShowForm(true);
  };

  const saveAndConnect = async () => {
    const savedRecord = saveCurrentForm();
    if (!savedRecord) return;
    await connectWithValues(savedRecord, formValues);
  };

  const deleteRecord = (record: SshConnectionRecord) => {
    if (activeConnections[record.id]) {
      showError('请先断开连接，再删除配置');
      return;
    }
    persistRecords(records.filter((item) => item.id !== record.id));
    if (selectedRecordId === record.id) {
      setSelectedRecordId(null);
    }
    if (editingRecord?.id === record.id) {
      setEditingRecord(null);
      setShowForm(false);
    }
    showSuccess('连接配置已删除');
  };

  const openWorkspaceTool = async (
    route: string,
    options?: BrowserWindowConstructorOptions,
  ) => {
    if (!selectedConnection) return;

    const { connectionId } = selectedConnection;
    setWorkspaceBusyConnections((current) => ({
      ...current,
      [connectionId]: true,
    }));
    try {
      const result = await createWindow(route, options, connectionId);
      if (!result.success) {
        showError(result.error || '打开功能窗口失败');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '打开功能窗口失败');
    } finally {
      setWorkspaceBusyConnections((current) => ({
        ...current,
        [connectionId]: false,
      }));
    }
  };

  const rebootWorkspaceConnection = async () => {
    if (!selectedConnection) return;

    const { connectionId } = selectedConnection;
    setWorkspaceBusyConnections((current) => ({
      ...current,
      [connectionId]: true,
    }));
    try {
      const result = await systemReboot(connectionId);
      if (result.success) {
        showSuccess('系统重启命令已发送');
      } else if (!result.canceled) {
        showError(result.error || '系统重启失败');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '系统重启失败');
    } finally {
      setWorkspaceBusyConnections((current) => ({
        ...current,
        [connectionId]: false,
      }));
    }
  };

  const disconnectRecord = async (
    record: SshConnectionRecord,
    connectionId: string,
  ) => {
    const result = await disconnect(connectionId);
    if (!result.success) {
      showError(result.error || '断开连接失败');
      return;
    }
    setActiveConnections((current) => {
      const nextConnections = { ...current };
      delete nextConnections[record.id];
      return nextConnections;
    });
    if (selectedConnection?.connectionId === connectionId) {
      setSelectedRecordId(null);
    }
    showSuccess('连接已断开');
  };

  const disconnectConnections = async (
    connections: ActiveConnection[],
  ): Promise<boolean> => {
    if (connections.length === 0) return true;

    const results = await Promise.all(
      connections.map((connection) => disconnect(connection.connectionId)),
    );
    const failedResult = results.find((result) => !result.success);

    if (failedResult) {
      showError(failedResult.error || '断开连接失败');
      return false;
    }

    return true;
  };

  const disconnectAllConnections = async () => {
    const connections = Object.values(activeConnections);
    const success = await disconnectConnections(connections);
    if (!success) return;

    setActiveConnections({});
    setWorkspaceBusyConnections({});
    setSelectedRecordId(null);
    showSuccess('全部连接已断开');
  };

  const clearAllConnections = async () => {
    const connections = Object.values(activeConnections);
    const success = await disconnectConnections(connections);
    if (!success) return;

    persistRecords([]);
    setActiveConnections({});
    setWorkspaceBusyConnections({});
    setSelectedRecordId(null);
    setEditingRecord(null);
    setShowForm(false);
    setFormErrors({});
    setSearchTerm('');
    showSuccess('已断开全部连接并清空历史');
  };

  const selectKeyFile = async () => {
    const { data, success } = await showOpenDialog({
      title: '选择私钥文件',
      defaultPath: '~/.ssh',
      properties: ['openFile', 'showHiddenFiles'],
    });

    if (success && data.filePath) {
      setFormValues((current) => ({
        ...current,
        jumpKeyFilePath: data.filePath,
      }));
      setFormErrors((current) => ({
        ...current,
        jumpKeyFilePath: undefined,
      }));
      showSuccess('私钥文件选择成功');
    }
  };

  return (
    <main className="yogo-page flex h-full flex-col [-webkit-app-region:no-drag]">
      <WindowTitlebar fallbackTitle="YOLINK WORKSPACE" />
      <section className="relative flex min-h-0 flex-1 gap-4 p-4 pt-3 [-webkit-app-region:no-drag] max-sm:p-3">
        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 top-[var(--yogo-titlebar-safe-height)] z-30 bg-slate-950/65 backdrop-blur-sm min-[861px]:hidden"
            aria-label="关闭设备侧边栏"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <div
          className={`z-40 flex min-h-0 shrink-0 transition-transform duration-200 max-[860px]:fixed max-[860px]:bottom-3 max-[860px]:left-3 max-[860px]:top-[calc(var(--yogo-titlebar-safe-height)+0.75rem)] max-[860px]:w-[min(22rem,calc(100vw-1.5rem))] ${
            isSidebarOpen
              ? 'max-[860px]:translate-x-0'
              : 'max-[860px]:-translate-x-[calc(100%+1rem)]'
          }`}
        >
          <ConnectionSidebar
            records={filteredRecords}
            recordCount={records.length}
            activeConnections={activeConnections}
            selectedRecordId={selectedRecordId || undefined}
            connectingId={connectingId}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onCreate={openCreateForm}
            onSelect={selectRecord}
            onConnect={openConnectionForm}
            onDelete={deleteRecord}
            onDisconnect={disconnectRecord}
            onDisconnectAll={disconnectAllConnections}
            onClearAll={clearAllConnections}
          />
        </div>
        <ConnectionWorkspacePanel
          record={selectedRecord}
          connection={selectedConnection}
          isBusy={Boolean(
            selectedConnection &&
            workspaceBusyConnections[selectedConnection.connectionId],
          )}
          deviceCount={records.length}
          onToggleSidebar={() => setIsSidebarOpen(true)}
          onOpenTool={openWorkspaceTool}
          onReboot={rebootWorkspaceConnection}
          onCreate={openCreateForm}
          onConnect={openConnectionForm}
          onDelete={deleteRecord}
          onDisconnect={disconnectRecord}
        />
      </section>

      {showForm && (
        <div className="yogo-modal-overlay z-50 grid place-items-center overflow-y-auto bg-slate-950/70 px-6 py-8 backdrop-blur-sm [-webkit-app-region:no-drag] max-sm:px-3 max-sm:py-4">
          <div className="yogo-panel w-full max-w-3xl rounded-3xl [-webkit-app-region:no-drag]">
            <SshConnectionForm
              values={formValues}
              isEditing={Boolean(editingRecord)}
              isConnecting={Boolean(connectingId)}
              hostOptions={hostOptions}
              errors={formErrors}
              onChange={(nextValues) => {
                setFormValues(nextValues);
                setFormErrors({});
              }}
              onSave={saveCurrentForm}
              onConnect={saveAndConnect}
              onCancel={() => {
                setFormErrors({});
                setShowForm(false);
              }}
              onSelectKeyFile={selectKeyFile}
            />
          </div>
        </div>
      )}
    </main>
  );
}
