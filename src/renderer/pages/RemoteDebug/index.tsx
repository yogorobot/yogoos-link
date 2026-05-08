import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { WebviewTag } from 'electron';
import WindowTitlebar from '../../components/WindowTitlebar';
import { useDebug } from '../../hooks';
import { useToast } from '../../components/NotificationProvider';
import { useWindow } from '../../hooks/useWindow';

interface DebugTarget {
  id?: string;
  title?: string;
  type?: string;
  url?: string;
  devtoolsFrontendUrl?: string;
  devToolsUrl: string;
}

interface WebviewEventWithError extends Event {
  errorCode?: number;
  errorDescription?: string;
  validatedURL?: string;
  isMainFrame?: boolean;
}

const getTargetId = (target: DebugTarget) => target.id || target.devToolsUrl;

const hasTargetId = (targetIds: string[], targetId: string) => {
  return targetIds.includes(targetId);
};

const debugLog = (event: string, payload?: Record<string, unknown>) => {
  const logPayload = { event, ...payload };
  console.info('[RemoteDebug:renderer]', logPayload);
  window.electron.ipcRenderer.sendMessage('debug:log', logPayload);
};

interface DebugWebviewProps {
  target: DebugTarget;
  targetId: string;
  isActive: boolean;
  onLoading: (targetId: string) => void;
  onLoaded: (targetId: string) => void;
  onRefChange: (targetId: string, webview: WebviewTag | null) => void;
}

function DebugWebview({
  target,
  targetId,
  isActive,
  onLoading,
  onLoaded,
  onRefChange,
}: DebugWebviewProps) {
  const [webview, setWebview] = useState<WebviewTag | null>(null);
  const isDomReadyRef = useRef(false);
  const isLoadStoppedRef = useRef(false);
  const isFrameFinishedRef = useRef(false);

  const bindWebview = useCallback(
    (element: WebviewTag | null) => {
      setWebview(element);
      onRefChange(targetId, element);
    },
    [onRefChange, targetId],
  );

  useEffect(() => {
    if (!webview) return undefined;

    const getCurrentUrl = () => {
      try {
        return webview.getURL?.() || '';
      } catch {
        return '';
      }
    };
    const logEvent = (eventName: string, extra?: Record<string, unknown>) => {
      debugLog(`webview:${eventName}`, {
        targetId,
        title: target.title,
        src: target.devToolsUrl,
        currentUrl: getCurrentUrl(),
        ...extra,
      });
    };
    const markLoadedWhenStable = () => {
      if (
        !isDomReadyRef.current ||
        !isLoadStoppedRef.current ||
        !isFrameFinishedRef.current
      ) {
        return;
      }
      logEvent('load-stable');
      onLoaded(targetId);
    };

    const handleStartLoading = () => {
      isLoadStoppedRef.current = false;
      isFrameFinishedRef.current = false;
      logEvent('did-start-loading');
      onLoading(targetId);
    };
    const handleStopLoading = () => {
      isLoadStoppedRef.current = true;
      logEvent('did-stop-loading');
      markLoadedWhenStable();
    };
    const handleFinishLoad = () => {
      logEvent('did-finish-load');
    };
    const handleFrameFinishLoad = () => {
      isFrameFinishedRef.current = true;
      logEvent('did-frame-finish-load');
      markLoadedWhenStable();
    };
    const handleDomReady = () => {
      isDomReadyRef.current = true;
      logEvent('dom-ready');
      markLoadedWhenStable();
    };
    const handleFailLoad = (event: WebviewEventWithError) => {
      logEvent('did-fail-load', {
        errorCode: event.errorCode,
        errorDescription: event.errorDescription,
        validatedURL: event.validatedURL,
        isMainFrame: event.isMainFrame,
      });
      onLoaded(targetId);
    };

    debugLog('webview:bind', {
      targetId,
      title: target.title,
      sourceUrl: target.url,
      devtoolsFrontendUrl: target.devtoolsFrontendUrl,
      devToolsUrl: target.devToolsUrl,
    });
    isDomReadyRef.current = false;
    isLoadStoppedRef.current = false;
    isFrameFinishedRef.current = false;
    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('did-finish-load', handleFinishLoad);
    webview.addEventListener('did-frame-finish-load', handleFrameFinishLoad);
    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-fail-load', handleFailLoad);

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('did-finish-load', handleFinishLoad);
      webview.removeEventListener(
        'did-frame-finish-load',
        handleFrameFinishLoad,
      );
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-fail-load', handleFailLoad);
    };
  }, [
    onLoaded,
    onLoading,
    target.devToolsUrl,
    target.devtoolsFrontendUrl,
    target.title,
    target.url,
    targetId,
    webview,
  ]);

  return (
    <webview
      ref={bindWebview}
      src={target.devToolsUrl}
      className={isActive ? 'block h-full w-full' : 'hidden'}
      style={{ border: 'none', display: isActive ? 'flex' : 'none' }}
    />
  );
}

const Index = () => {
  const { debugConnect, debugDisconnect, getDebugTargets } = useDebug();
  const { closeWindow } = useWindow();
  const { showSuccess, showError } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [targets, setTargets] = useState<DebugTarget[]>([]);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [visitedTargetIds, setVisitedTargetIds] = useState<string[]>([]);
  const [loadingTargets, setLoadingTargets] = useState<Record<string, boolean>>(
    {},
  );
  const [assignedLocalPort, setAssignedLocalPort] = useState<number | null>(
    null,
  );
  const [requiresRemoteDebugConfig, setRequiresRemoteDebugConfig] =
    useState(false);
  const hasStartedRef = useRef(false);
  const activeTargetIdRef = useRef<string | null>(null);
  const webviewRefs = useRef<Record<string, WebviewTag | null>>({});
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isClosingRef = useRef(false);
  const activeTarget =
    targets.find((target) => getTargetId(target) === activeTargetId) || null;
  const isActiveTargetLoading = activeTargetId
    ? Boolean(loadingTargets[activeTargetId])
    : false;

  useEffect(() => {
    activeTargetIdRef.current = activeTargetId;
  }, [activeTargetId]);

  const closeDebugWindow = useCallback(
    async (reason: string) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      debugLog('window:close', { reason });
      await debugDisconnect();
      await closeWindow();
    },
    [closeWindow, debugDisconnect],
  );

  useEffect(() => {
    if (!activeTargetId) return;
    tabRefs.current[activeTargetId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeTargetId]);

  const connectDebug = useCallback(
    async (enableDebug = false) => {
      setIsExecuting(true);
      try {
        setRequiresRemoteDebugConfig(false);
        const result = await debugConnect({
          'remote-port': '8315',
          'enable-debug': enableDebug,
        });
        if (result.success) {
          const nextTargets = result.data.targets;
          const firstTarget = nextTargets[0];
          const firstTargetId = firstTarget ? getTargetId(firstTarget) : null;
          debugLog('connect:targets', {
            localPort: result.data.localPort,
            remotePort: result.data.remotePort,
            targets: nextTargets.map((target) => ({
              id: target.id,
              title: target.title,
              url: target.url,
              devtoolsFrontendUrl: target.devtoolsFrontendUrl,
              devToolsUrl: target.devToolsUrl,
            })),
          });
          setTargets(nextTargets);
          setActiveTargetId(firstTargetId);
          if (firstTargetId) {
            setVisitedTargetIds([firstTargetId]);
            setLoadingTargets({ [firstTargetId]: true });
          }
          setAssignedLocalPort(result.data.localPort);
          showSuccess('调试连接成功');
          return;
        }

        if (result.error === 'REMOTE_DEBUG_NOT_CONFIGURED') {
          setRequiresRemoteDebugConfig(true);
          return;
        }

        const errorMsg = result.error || '调试连接失败';
        showError(`调试连接失败: ${errorMsg}`);
        await closeDebugWindow(errorMsg);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        showError(`调试连接失败: ${errorMsg}`);
        await closeDebugWindow(errorMsg);
      } finally {
        setIsExecuting(false);
      }
    },
    [closeDebugWindow, debugConnect, showError, showSuccess],
  );

  const enableRemoteDebugging = () => {
    connectDebug(true);
  };

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    connectDebug();
    // 首次进入页面即建立调试通道，避免用户再点一次连接。
  }, [connectDebug]);

  useEffect(() => {
    if (!assignedLocalPort) return undefined;

    let isMounted = true;
    const refreshTargets = async () => {
      try {
        const result = await getDebugTargets();
        if (!result?.success) {
          const errorMsg = result?.error || '调试服务已断开';
          showError(errorMsg);
          await closeDebugWindow(errorMsg);
          return;
        }
        const nextTargets = result.data || [];
        if (!isMounted) return;

        const currentTargetId = activeTargetIdRef.current;
        const hasCurrentTarget = Boolean(
          currentTargetId &&
          nextTargets.some((target) => getTargetId(target) === currentTargetId),
        );
        let nextActiveTargetId = hasCurrentTarget ? currentTargetId : null;
        if (!nextActiveTargetId && nextTargets[0]) {
          nextActiveTargetId = getTargetId(nextTargets[0]);
        }

        setTargets(nextTargets);
        if (nextActiveTargetId !== currentTargetId && nextActiveTargetId) {
          setVisitedTargetIds((current) =>
            hasTargetId(current, nextActiveTargetId)
              ? current
              : [...current, nextActiveTargetId],
          );
          setLoadingTargets((current) => ({
            ...current,
            [nextActiveTargetId]: !webviewRefs.current[nextActiveTargetId],
          }));
        }
        setActiveTargetId(nextActiveTargetId);
        const nextTargetIds = new Set(nextTargets.map(getTargetId));
        setVisitedTargetIds((current) =>
          current.filter((targetId) => nextTargetIds.has(targetId)),
        );
        setLoadingTargets((current) => {
          const nextLoadingTargets: Record<string, boolean> = {};
          Object.entries(current).forEach(([targetId, isLoading]) => {
            if (nextTargetIds.has(targetId)) {
              nextLoadingTargets[targetId] = isLoading;
            }
          });
          return nextLoadingTargets;
        });
        Object.keys(webviewRefs.current).forEach((targetId) => {
          if (!nextTargetIds.has(targetId)) {
            delete webviewRefs.current[targetId];
          }
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : '调试服务已断开';
        showError(errorMsg);
        await closeDebugWindow(errorMsg);
      }
    };

    const timer = window.setInterval(refreshTargets, 2000);
    refreshTargets();

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [assignedLocalPort, closeDebugWindow, getDebugTargets, showError]);

  const selectTarget = (target: DebugTarget) => {
    const targetId = getTargetId(target);
    if (targetId === activeTargetId) return;
    setActiveTargetId(targetId);
    setVisitedTargetIds((current) =>
      hasTargetId(current, targetId) ? current : [...current, targetId],
    );
    setLoadingTargets((current) => ({
      ...current,
      [targetId]: !webviewRefs.current[targetId],
    }));
  };

  const refreshTarget = (
    event: MouseEvent<HTMLButtonElement>,
    target: DebugTarget,
  ) => {
    event.stopPropagation();
    const targetId = getTargetId(target);
    if (targetId !== activeTargetId) {
      setActiveTargetId(targetId);
    }
    setVisitedTargetIds((current) =>
      hasTargetId(current, targetId) ? current : [...current, targetId],
    );
    setLoadingTargets((current) => ({
      ...current,
      [targetId]: true,
    }));
    const webview = webviewRefs.current[targetId];
    debugLog('webview:reload', {
      targetId,
      title: target.title,
      src: target.devToolsUrl,
      currentUrl: webview?.getURL?.(),
    });
    webview?.reloadIgnoringCache();
  };

  const markTargetLoading = useCallback((targetId: string) => {
    setLoadingTargets((current) => ({ ...current, [targetId]: true }));
  }, []);

  const markTargetLoaded = useCallback((targetId: string) => {
    setLoadingTargets((current) => ({ ...current, [targetId]: false }));
  }, []);

  const setWebviewRef = useCallback(
    (targetId: string, element: WebviewTag | null) => {
      webviewRefs.current[targetId] = element;
    },
    [],
  );

  return (
    <div className="yogo-page flex h-full min-h-0 w-full flex-col">
      <WindowTitlebar fallbackTitle="远程调试" />
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-950/70 shadow-2xl backdrop-blur-xl">
        {targets.length > 0 && (
          <div className="flex h-12 shrink-0 items-end gap-2 border-b border-white/10 bg-slate-950/80 px-2 pt-2 [-webkit-app-region:no-drag]">
            <div className="mb-2 hidden shrink-0 rounded-full border border-slate-700/70 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-400 sm:block">
              {targets.length} 个页面
            </div>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain pb-px [scrollbar-width:thin]">
              {targets.map((target, index) => {
                const targetId = getTargetId(target);
                const isActive = targetId === activeTargetId;
                return (
                  <div
                    key={targetId}
                    ref={(element) => {
                      tabRefs.current[targetId] = element;
                    }}
                    role="tab"
                    tabIndex={0}
                    aria-selected={isActive}
                    className={`flex h-10 w-44 shrink-0 cursor-pointer select-none items-center gap-2 rounded-t-xl border px-2.5 text-xs transition max-sm:w-36 ${
                      isActive
                        ? 'border-white/15 border-b-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-950/40'
                        : 'border-transparent bg-slate-800/55 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    onClick={() => selectTarget(target)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      selectTarget(target);
                    }}
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-left font-medium"
                      title={target.title || `页面 ${index + 1}`}
                    >
                      <span className="mr-1 text-slate-500">{index + 1}</span>
                      {target.title || `页面 ${index + 1}`}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-700/80 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      aria-label={`刷新 ${target.title || `页面 ${index + 1}`}`}
                      onClick={(event) => refreshTarget(event, target)}
                    >
                      <svg
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20 6v5h-5" />
                        <path d="M4 18v-5h5" />
                        <path d="M18.5 9A7 7 0 0 0 6.1 6.1L4 8" />
                        <path d="M5.5 15A7 7 0 0 0 17.9 17.9L20 16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {(() => {
          if (requiresRemoteDebugConfig) {
            return (
              <div className="grid h-full place-items-center p-6 text-center [-webkit-app-region:no-drag]">
                <section className="yogo-panel max-w-md rounded-3xl p-6">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
                    <svg
                      aria-hidden="true"
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    未开启远程调试
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    目标主机未配置调试端口。启用后会重启远程服务，稍后自动重新连接。
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <button
                      type="button"
                      className="yogo-button-secondary rounded-xl px-4 py-2.5 text-sm font-medium transition"
                      onClick={() => closeDebugWindow('用户取消启用远程调试')}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="yogo-button-primary rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                      onClick={enableRemoteDebugging}
                    >
                      启用并重启
                    </button>
                  </div>
                </section>
              </div>
            );
          }

          if (activeTarget) {
            return (
              <div className="relative h-full w-full">
                {targets
                  .filter((target) =>
                    visitedTargetIds.includes(getTargetId(target)),
                  )
                  .map((target) => {
                    const targetId = getTargetId(target);
                    const isActive = targetId === activeTargetId;

                    return (
                      <DebugWebview
                        key={targetId}
                        target={target}
                        targetId={targetId}
                        isActive={isActive}
                        onLoading={markTargetLoading}
                        onLoaded={markTargetLoaded}
                        onRefChange={setWebviewRef}
                      />
                    );
                  })}
                {isActiveTargetLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
                    <p className="mt-4 text-sm text-slate-300">
                      正在加载调试页面...
                    </p>
                  </div>
                )}
              </div>
            );
          }

          if (isExecuting) {
            return (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-white/70">正在连接调试服务...</p>
              </div>
            );
          }

          return (
            <div className="flex h-full flex-col items-center justify-center">
              <p className="mb-3 text-sm text-white/70">
                正在准备调试通道，页面会自动连接。
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Index;
