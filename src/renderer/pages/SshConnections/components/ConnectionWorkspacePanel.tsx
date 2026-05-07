import { BrowserWindowConstructorOptions } from 'electron';
import type { ActiveConnection, SshConnectionRecord } from '../types';

interface WorkspaceAction {
  id: string;
  title: string;
  description: string;
  label: string;
  route?: string;
  options?: BrowserWindowConstructorOptions;
  danger?: boolean;
}

const workspaceActions: WorkspaceAction[] = [
  {
    id: 'real-time-log',
    title: '实时日志',
    description: '实时查看和分析系统日志，监控应用运行状态。',
    label: '查看日志',
    route: 'log-real-time-viewer',
    options: { resizable: true },
  },
  {
    id: 'history-log',
    title: '历史日志',
    description: '查看历史日志文件，分析系统问题和性能趋势。',
    label: '查看日志',
    route: 'log-history-viewer',
    options: { resizable: true },
  },
  {
    id: 'remote-debug',
    title: '远程调试',
    description: '远程应用调试和问题排查，实时监控应用状态。',
    label: '开始调试',
    route: 'remote-debug',
    options: { resizable: true, webPreferences: { webviewTag: true } },
  },
  {
    id: 'app-update',
    title: 'UI 应用升级',
    description: '上传并更新远程 UI 应用，完成后重启服务。',
    label: '手动升级',
    route: 'app-update',
    options: { width: 500, height: 650 },
  },
  {
    id: 'app-switch',
    title: '应用切换',
    description: '修改启动配置，切换目标设备运行的应用。',
    label: '打开设置',
    route: 'app-switch',
    options: { width: 500, height: 750 },
  },
  {
    id: 'package-manager',
    title: '机器人包裹',
    description: '查看机器人当前包裹内容，并支持一键清空。',
    label: '查看包裹',
    route: 'package-manager',
    options: { width: 500, height: 650 },
  },
  {
    id: 'storage-viewer',
    title: '设备存储',
    description: '查看远程设备磁盘使用情况和可用空间。',
    label: '查看存储',
    route: 'storage-viewer',
    options: { height: 600 },
  },
  {
    id: 'system-reboot',
    title: '系统重启',
    description: '向远程系统发送重启命令，当前连接会短暂中断。',
    label: '系统重启',
    danger: true,
  },
];

interface ConnectionWorkspacePanelProps {
  record: SshConnectionRecord | null;
  connection: ActiveConnection | null;
  isBusy: boolean;
  deviceCount: number;
  onToggleSidebar: () => void;
  onOpenTool: (
    route: string,
    options?: BrowserWindowConstructorOptions,
  ) => void;
  onReboot: () => void;
  onCreate: () => void;
  onConnect: (record: SshConnectionRecord) => void;
  onDelete: (record: SshConnectionRecord) => void;
  onDisconnect: (record: SshConnectionRecord, connectionId: string) => void;
}

export default function ConnectionWorkspacePanel({
  record,
  connection,
  isBusy,
  deviceCount,
  onToggleSidebar,
  onOpenTool,
  onReboot,
  onCreate,
  onConnect,
  onDelete,
  onDisconnect,
}: ConnectionWorkspacePanelProps) {
  const switchDeviceButton = (
    <button
      type="button"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/80 text-slate-400 transition hover:border-blue-400/50 hover:bg-slate-800/70 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      aria-label="切换设备"
      onClick={onToggleSidebar}
    >
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M8 7h11" />
        <path d="m16 4 3 3-3 3" />
        <path d="M16 17H5" />
        <path d="m8 14-3 3 3 3" />
      </svg>
    </button>
  );

  if (!record) {
    return (
      <section className="yogo-panel flex min-h-0 flex-1 flex-col rounded-3xl">
        <div className="hidden items-start justify-between gap-3 border-b border-slate-700/70 px-5 py-4 max-[860px]:flex">
          <div className="min-w-0 text-left">
            <h2 className="truncate text-base font-semibold text-slate-100">
              选择设备
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">
              共 {deviceCount} 个历史配置
            </p>
          </div>
          {switchDeviceButton}
        </div>
        <div className="grid min-h-0 flex-1 place-items-center p-8 text-center max-sm:p-5">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold text-slate-100 max-sm:text-xl">
              选择一台设备开始操作
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              左侧包含历史连接和在线状态。点击卡片只切换当前设备，连接动作由按钮显式触发。
            </p>
            <button
              type="button"
              className="yogo-button-primary mt-6 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
              onClick={onCreate}
            >
              新建连接
            </button>
          </div>
        </div>
      </section>
    );
  }

  const isConnected = Boolean(connection);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden shrink-0 max-[860px]:block">
          {switchDeviceButton}
        </div>
        <section className="yogo-panel min-w-0 flex-1 rounded-2xl px-4 py-3">
          <div className="flex min-w-0 items-center justify-between gap-4 max-sm:flex-wrap max-sm:gap-3">
            <div className="flex min-h-7 min-w-0 flex-1 items-center gap-3 max-sm:w-full max-sm:items-start">
              <span
                className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
              <div className="min-w-0 flex-1 text-sm leading-7 text-slate-300 max-sm:leading-6">
                <span
                  className={`mr-3 inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium leading-none ${
                    isConnected
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-600 bg-slate-800/80 text-slate-400'
                  }`}
                >
                  {isConnected ? '在线' : '离线'}
                </span>
                <span className="break-all font-semibold text-slate-100">
                  {record.username}@{record.host}:{record.port}
                </span>
                {record.useJumpHost && (
                  <>
                    <span className="mx-2 text-slate-600">/</span>
                    <span className="break-all text-slate-500">
                      跳板机 {record.jumpUsername}@{record.jumpHost}:
                      {record.jumpPort}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex shrink-0 self-center">
              {connection && (
                <button
                  type="button"
                  className="yogo-button-danger h-7 rounded-lg px-2.5 text-xs font-medium leading-none transition"
                  onClick={() => onDisconnect(record, connection.connectionId)}
                >
                  断开
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
      {!connection ? (
        <section className="yogo-panel grid min-h-0 flex-1 place-items-center rounded-3xl p-8 text-center max-sm:p-5">
          <div className="max-w-md">
            <h3 className="text-xl font-semibold text-slate-100">设备未连接</h3>
            <p className="mt-2 text-sm text-slate-500">连接后打开工作台</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="yogo-button-danger rounded-xl px-4 py-2.5 text-sm font-medium transition"
                onClick={() => onDelete(record)}
              >
                删除
              </button>
              <button
                type="button"
                className="yogo-button-primary rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                onClick={() => onConnect(record)}
              >
                连接设备
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="yogo-panel min-h-0 flex-1 overflow-y-auto rounded-3xl p-6 max-sm:p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 max-sm:grid-cols-1">
            {workspaceActions.map((action) => (
              <article
                key={action.id}
                className="yogo-card yogo-card-hover flex min-h-42 flex-col justify-between rounded-2xl p-5"
              >
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    {action.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {action.description}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  className={
                    action.danger
                      ? 'yogo-button-danger mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'
                      : 'yogo-button-primary mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'
                  }
                  onClick={() => {
                    if (action.danger) {
                      onReboot();
                      return;
                    }
                    if (action.route) {
                      onOpenTool(action.route, action.options);
                    }
                  }}
                >
                  {isBusy ? '处理中...' : action.label}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
