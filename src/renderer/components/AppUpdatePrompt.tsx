import { useEffect, useState } from 'react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { useToast } from './NotificationProvider';
import type { AppUpdateState } from '../hooks/useAutoUpdate';

const shouldShowPrompt = (state: AppUpdateState | null) => {
  return Boolean(state && state.status === 'available');
};

interface AppUpdatePromptProps {
  open: boolean;
  state?: AppUpdateState | null;
  onOpenChange: (open: boolean) => void;
}

export default function AppUpdatePrompt({
  open,
  state,
  onOpenChange,
}: AppUpdatePromptProps) {
  const [internalUpdateState, setInternalUpdateState] =
    useState<AppUpdateState | null>(null);
  const { getUpdateState, openDownloadPage } = useAutoUpdate();
  const { showError } = useToast();
  const updateState = state || internalUpdateState;

  useEffect(() => {
    getUpdateState()
      .then((result) => {
        if (result?.success) {
          setInternalUpdateState(result.data);
        }
        return null;
      })
      .catch(() => null);

    const unsubscribe = window.electron.ipcRenderer.on(
      'update:event',
      (payload) => {
        const nextState = payload as AppUpdateState;
        setInternalUpdateState(nextState);
        if (nextState.status !== 'available') {
          onOpenChange(false);
        }
      },
    );

    return unsubscribe;
  }, [getUpdateState, onOpenChange]);

  if (!open || !shouldShowPrompt(updateState)) return null;

  const availableVersion = updateState?.availableVersion || '新版本';

  const handleOpenDownloadPage = async () => {
    const result = await openDownloadPage();
    if (!result?.success) {
      showError(result?.error || '打开下载页面失败');
    }
  };

  return (
    <div className="yogo-modal-overlay z-[70] grid place-items-center overflow-y-auto bg-slate-950/70 px-6 py-8 backdrop-blur-sm [-webkit-app-region:no-drag] max-sm:place-items-start max-sm:px-3 max-sm:py-4">
      <section className="yogo-panel my-auto max-h-full w-full max-w-lg overflow-y-auto rounded-3xl p-6 text-slate-100 [-webkit-app-region:no-drag] max-sm:my-0 max-sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-300/80">
              应用更新
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">
              {`发现 ${availableVersion}`}
            </h2>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
          <p>
            当前版本 {updateState?.currentVersion}，
            {updateState?.isTestingChannel ? '测试通道' : '正式通道'}。
          </p>
          <p className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-blue-100">
            当前版本需要手动下载安装，点击下方按钮前往 Release 下载页面。
          </p>
          {updateState?.releaseUrl && (
            <p className="break-all rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-500">
              {updateState.releaseUrl}
            </p>
          )}
          {updateState?.releaseNotes && (
            <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
              {updateState.releaseNotes}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
          <button
            type="button"
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800/70 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-600/60"
            onClick={() => onOpenChange(false)}
          >
            稍后
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60 disabled:cursor-not-allowed disabled:bg-blue-500/60 disabled:shadow-none"
            onClick={handleOpenDownloadPage}
          >
            前往下载
          </button>
        </div>
      </section>
    </div>
  );
}
