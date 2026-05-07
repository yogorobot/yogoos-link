import { useEffect, useState } from 'react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { useToast } from './NotificationProvider';
import type { AppUpdateState } from '../hooks/useAutoUpdate';

const shouldShowPrompt = (state: AppUpdateState | null) => {
  return Boolean(
    state &&
    ['available', 'downloading', 'downloaded', 'error'].includes(state.status),
  );
};

export default function AppUpdatePrompt() {
  const [updateState, setUpdateState] = useState<AppUpdateState | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const { getUpdateState, downloadUpdate, installUpdate } = useAutoUpdate();
  const { showError } = useToast();

  useEffect(() => {
    getUpdateState()
      .then((result) => {
        if (result?.success) {
          setUpdateState(result.data);
        }
        return null;
      })
      .catch(() => null);

    const unsubscribe = window.electron.ipcRenderer.on(
      'update:event',
      (payload) => {
        const nextState = payload as AppUpdateState;
        setUpdateState(nextState);
        if (nextState.status === 'available') {
          setIsHidden(false);
        }
      },
    );

    return unsubscribe;
  }, [getUpdateState]);

  if (!shouldShowPrompt(updateState) || isHidden) return null;

  const availableVersion = updateState?.availableVersion || '新版本';
  const isDownloading = updateState?.status === 'downloading';
  const isDownloaded = updateState?.status === 'downloaded';
  const isError = updateState?.status === 'error';
  const progress = updateState?.progress ?? 0;

  const handleDownload = async () => {
    const result = await downloadUpdate();
    if (!result?.success) {
      showError(result?.error || '更新下载失败');
    }
  };

  const handleInstall = async () => {
    const result = await installUpdate();
    if (!result?.success) {
      showError(result?.error || '更新安装失败');
    }
  };

  return (
    <div className="yogo-modal-overlay z-[70] grid place-items-center bg-slate-950/70 px-6 py-8 backdrop-blur-sm [-webkit-app-region:no-drag] max-sm:px-3 max-sm:py-4">
      <section className="yogo-panel w-full max-w-lg rounded-3xl p-6 text-slate-100 [-webkit-app-region:no-drag] max-sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-300/80">
              应用更新
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">
              {isDownloaded ? '更新已下载' : `发现 ${availableVersion}`}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-100"
            onClick={() => setIsHidden(true)}
          >
            稍后
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
          <p>
            当前版本 {updateState?.currentVersion}，
            {updateState?.isTestingChannel ? '测试通道' : '正式通道'}。
          </p>
          {updateState?.releaseNotes && (
            <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
              {updateState.releaseNotes}
            </div>
          )}
          {isError && (
            <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-red-200">
              {updateState?.error || '更新失败'}
            </p>
          )}
        </div>

        {isDownloading && (
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs text-slate-400">
              <span>正在下载</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
          <button
            type="button"
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800/70 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-600/60"
            onClick={() => setIsHidden(true)}
          >
            稍后
          </button>
          {!isDownloaded && (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60 disabled:cursor-not-allowed disabled:bg-blue-500/60 disabled:shadow-none"
              disabled={isDownloading}
              onClick={handleDownload}
            >
              {isDownloading ? '下载中...' : '立即下载'}
            </button>
          )}
          {isDownloaded && (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
              onClick={handleInstall}
            >
              重启安装
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
