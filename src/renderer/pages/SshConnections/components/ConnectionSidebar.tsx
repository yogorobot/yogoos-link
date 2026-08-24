import type { MouseEvent } from 'react';
import type { ActiveConnection, SshConnectionRecord } from '../types';

type ButtonClickEvent = MouseEvent<HTMLButtonElement>;

interface ConnectionSidebarProps {
  records: SshConnectionRecord[];
  recordCount: number;
  activeConnections: Record<string, ActiveConnection>;
  selectedRecordId?: string;
  connectingId: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onSelect: (record: SshConnectionRecord) => void;
  onConnect: (record: SshConnectionRecord) => void;
  onDelete: (record: SshConnectionRecord) => void;
  onDisconnect: (record: SshConnectionRecord, connectionId: string) => void;
  onDisconnectAll: () => void;
  onClearAll: () => void;
}

const formatUpdatedAt = (updatedAt: number) =>
  new Date(updatedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function ConnectionSidebar({
  records,
  recordCount,
  activeConnections,
  selectedRecordId,
  connectingId,
  searchTerm,
  onSearchChange,
  onCreate,
  onSelect,
  onConnect,
  onDelete,
  onDisconnect,
  onDisconnectAll,
  onClearAll,
}: ConnectionSidebarProps) {
  const activeConnectionCount = Object.keys(activeConnections).length;
  const hasRecords = recordCount > 0;
  const hasActiveConnections = activeConnectionCount > 0;

  return (
    <aside className="yogo-panel flex min-h-0 w-86 flex-1 shrink-0 flex-col rounded-3xl max-[860px]:w-full">
      <header className="border-b border-slate-700/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">设备</h2>
            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs text-slate-400">
              {records.length}
            </span>
          </div>
          <button
            type="button"
            className="yogo-button-primary flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition"
            aria-label="新建连接"
            onClick={onCreate}
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>新建连接</span>
          </button>
        </div>

        <div>
          <input
            className="yogo-input w-full rounded-xl px-3 py-2 text-sm"
            placeholder="搜索 host"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {records.length === 0 ? (
          <button
            type="button"
            className="grid min-h-36 w-full place-items-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 px-4 text-center text-sm text-slate-400 transition hover:border-blue-400/60 hover:text-slate-200"
            onClick={onCreate}
          >
            暂无连接，点击新建
          </button>
        ) : (
          <div className="grid gap-2">
            {records.map((record) => {
              const connection = activeConnections[record.id];
              const isConnected = Boolean(connection);
              const isSelected = record.id === selectedRecordId;

              return (
                <article
                  key={record.id}
                  className={`relative rounded-2xl border p-3 transition ${
                    isSelected
                      ? 'border-blue-400/70 bg-blue-500/12'
                      : 'border-slate-700/70 bg-slate-950/28 hover:border-slate-500/80 hover:bg-slate-900/72'
                  }`}
                >
                  <button
                    type="button"
                    className="absolute inset-0 z-0 cursor-pointer rounded-2xl"
                    aria-label={`切换到 ${record.host}`}
                    onClick={() => onSelect(record)}
                  />
                  <div className="pointer-events-none relative z-10 w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-all text-sm font-semibold leading-5 text-slate-100">
                          {record.host}
                        </h3>
                        <p className="mt-1 break-all text-xs leading-5 text-slate-400">
                          {record.username}@{record.host}:{record.port}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          isConnected
                            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-600 bg-slate-800/80 text-slate-400'
                        }`}
                      >
                        {isConnected ? '在线' : '离线'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>{formatUpdatedAt(record.updatedAt)}</span>
                      {record.useJumpHost && (
                        <span className="break-all text-blue-300/80">
                          跳板 {record.jumpHost}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pointer-events-none relative z-10 mt-3 flex items-center justify-end gap-2 border-t border-slate-800 pt-2">
                    {isConnected && connection ? (
                      <button
                        type="button"
                        className="yogo-button-danger pointer-events-auto rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                        onClick={(event: ButtonClickEvent) => {
                          event.stopPropagation();
                          onDisconnect(record, connection.connectionId);
                        }}
                      >
                        断开
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="yogo-button-danger pointer-events-auto rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                          onClick={(event: ButtonClickEvent) => {
                            event.stopPropagation();
                            onDelete(record);
                          }}
                        >
                          删除
                        </button>
                        <button
                          type="button"
                          disabled={connectingId === record.id}
                          className="yogo-button-primary pointer-events-auto rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={(event: ButtonClickEvent) => {
                            event.stopPropagation();
                            onConnect(record);
                          }}
                        >
                          {connectingId === record.id ? '连接中' : '连接'}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <footer className="border-t border-slate-700/70 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>已连接 {activeConnectionCount}</span>
          <span>历史 {recordCount}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="yogo-button-secondary rounded-xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!hasActiveConnections}
            onClick={onDisconnectAll}
          >
            全部断开
          </button>
          <button
            type="button"
            className="yogo-button-danger rounded-xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!hasRecords && !hasActiveConnections}
            onClick={onClearAll}
          >
            一键清空
          </button>
        </div>
      </footer>
    </aside>
  );
}
