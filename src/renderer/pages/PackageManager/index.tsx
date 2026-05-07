import React, { useState, useEffect, useCallback, useRef } from 'react';
import WindowTitlebar from '../../components/WindowTitlebar';
import { usePackage } from '../../hooks/usePackage';

interface PackageInfo {
  upperPackages: number[];
  lowerPackages: number[];
  totalCount: number;
}

const PackageManager: React.FC = () => {
  const { packageQuery, packageClear, packageClearSingle } = usePackage();
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [clearingPackages, setClearingPackages] = useState<Set<number>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<PackageInfo | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // 确认对话框状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'clear-all' | 'clear-single';
    packageId?: number;
    message: string;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isManualRefreshingRef = useRef(false);

  // 清理定时器的统一方法
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 启动定时器
  const startTimer = useCallback(() => {
    clearTimer(); // 先清理现有定时器
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current && !isManualRefreshingRef.current) {
        // 直接调用异步函数避免循环依赖
        const autoFetch = async () => {
          if (!isMountedRef.current) return;

          try {
            const { data: res } = await packageQuery();
            if (!isMountedRef.current) return;

            setInfo(res);
            setLastRefreshTime(new Date());

            if (res.totalCount === 0) {
              setSuccess('当前包裹为空');
            } else {
              setSuccess(null);
            }
            setError(null);
          } catch (e: any) {
            if (!isMountedRef.current) return;
            setError(e.message || '查询失败');
          } finally {
            if (isMountedRef.current) {
              // 自动刷新完成后重新启动定时器
              clearTimer();
              timerRef.current = setTimeout(() => {
                if (isMountedRef.current && !isManualRefreshingRef.current) {
                  autoFetch();
                }
              }, 5000);
            }
          }
        };
        autoFetch();
      }
    }, 5000); // 5秒定时刷新
  }, [clearTimer, packageQuery]);

  // 获取包裹数据
  const fetchPackages = useCallback(
    async (isManual = false) => {
      if (!isMountedRef.current) return;

      // 如果是手动刷新，设置标记并清除定时器
      if (isManual) {
        isManualRefreshingRef.current = true;
        clearTimer();
        setLoading(true);
      }

      setError(null);
      setSuccess(null);

      try {
        const { data: res } = await packageQuery();

        if (!isMountedRef.current) return;

        setInfo(res);
        setLastRefreshTime(new Date());

        if (res.totalCount === 0) {
          setSuccess('当前包裹为空');
        }
      } catch (e: any) {
        if (!isMountedRef.current) return;
        setError(e.message || '查询失败');
      } finally {
        if (isMountedRef.current) {
          if (isManual) {
            setLoading(false);
            isManualRefreshingRef.current = false;
          }

          // 无论是手动还是自动刷新，都重新启动定时器
          startTimer();
        }
      }
    },
    [packageQuery, clearTimer, startTimer],
  );

  // 组件挂载和卸载处理
  useEffect(() => {
    isMountedRef.current = true;

    // 初始化时立即获取一次数据
    const initFetch = async () => {
      await fetchPackages(true);
    };
    initFetch();

    // 组件卸载时清理
    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 手动刷新
  const handleManualRefresh = useCallback(async () => {
    if (loading || clearing) return;
    await fetchPackages(true);
  }, [loading, clearing, fetchPackages]);

  // 请求清空包裹确认
  const handleClearRequest = useCallback(() => {
    if (!info || info.totalCount === 0 || clearing) return;

    setConfirmAction({
      type: 'clear-all',
      message: `确定要清空所有 ${info.totalCount} 个包裹吗？此操作无法撤销。`,
    });
    setShowConfirmDialog(true);
  }, [info, clearing]);

  // 清空包裹
  const handleClear = useCallback(async () => {
    if (!info || info.totalCount === 0 || clearing) return;

    clearTimer();
    setClearing(true);
    setError(null);
    setSuccess(null);

    try {
      const { success: successed } = await packageClear();

      if (successed) {
        setSuccess('包裹清理成功');
        setInfo({ upperPackages: [], lowerPackages: [], totalCount: 0 });
      } else {
        setSuccess('包裹清理失败');
      }
    } catch (e: any) {
      setError(e.message || '清理失败');
    } finally {
      setClearing(false);
      // 清理后重新启动定时刷新
      startTimer();
    }
  }, [info, clearing, clearTimer, packageClear, startTimer]);

  // 请求清空单个包裹确认
  const handleClearSingleRequest = useCallback(
    (packageId: number) => {
      if (clearingPackages.has(packageId) || clearing) return;

      setConfirmAction({
        type: 'clear-single',
        packageId,
        message: `确定要清空包裹 ${packageId} 吗？此操作无法撤销。`,
      });
      setShowConfirmDialog(true);
    },
    [clearingPackages, clearing],
  );

  // 确认执行操作
  const handleConfirm = useCallback(async () => {
    if (!confirmAction) return;

    setShowConfirmDialog(false);

    if (confirmAction.type === 'clear-all') {
      await handleClear();
    } else if (
      confirmAction.type === 'clear-single' &&
      confirmAction.packageId
    ) {
      // 直接执行清空逻辑，避免循环依赖
      const { packageId } = confirmAction;
      if (clearingPackages.has(packageId) || clearing) return;

      setClearingPackages((prev) => new Set(prev).add(packageId));
      setError(null);
      setSuccess(null);

      try {
        const { success: successed } = await packageClearSingle(packageId);

        console.log('cleared single', successed);
        if (successed) {
          setSuccess(`包裹 ${packageId} 清理成功`);
          // 从当前状态中移除已清理的包裹
          setInfo((prevInfo) => {
            if (!prevInfo) return null;
            return {
              upperPackages: prevInfo.upperPackages.filter(
                (id) => id !== packageId,
              ),
              lowerPackages: prevInfo.lowerPackages.filter(
                (id) => id !== packageId,
              ),
              totalCount: prevInfo.totalCount - 1,
            };
          });
        } else {
          setError(`包裹 ${packageId} 清理失败`);
        }
      } catch (e: any) {
        setError(e.message || `清理包裹 ${packageId} 失败`);
      } finally {
        setClearingPackages((prev) => {
          const newSet = new Set(prev);
          newSet.delete(packageId);
          return newSet;
        });
      }
    }

    setConfirmAction(null);
  }, [
    confirmAction,
    handleClear,
    clearingPackages,
    clearing,
    packageClearSingle,
  ]);

  // 取消操作
  const handleCancel = useCallback(() => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, []);

  return (
    <div className="yogo-page relative flex h-full w-full max-w-none flex-col overflow-hidden">
      <WindowTitlebar fallbackTitle="机器人包裹" />
      {/* 主要内容区域 */}
      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto p-4 [-webkit-app-region:no-drag]">
        {/* Summary Bar - 移到卡片区域上方 */}
        <div className="yogo-panel mb-4 flex items-center justify-between rounded-3xl p-4 max-sm:flex-col max-sm:items-start max-sm:gap-3">
          <div className="flex items-center gap-4">
            <span className="text-base text-slate-400">包裹总数</span>
            <span className="text-3xl font-bold tabular-nums text-slate-100">
              {loading && !info ? '-' : (info?.totalCount ?? '0')}
            </span>
          </div>
          <div className="flex items-center gap-3 max-sm:w-full max-sm:justify-between">
            <p className="text-xs text-slate-500">
              每5秒自动刷新
              {lastRefreshTime && (
                <span className="ml-2 text-slate-600">
                  上次更新: {lastRefreshTime.toLocaleTimeString()}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={loading || clearing}
              className="yogo-button-secondary rounded-full p-2 transition disabled:cursor-not-allowed disabled:opacity-50"
              title="手动刷新"
              aria-label="手动刷新包裹信息"
            >
              <svg
                className={`h-5 w-5 text-slate-300 ${loading ? 'animate-spin' : ''}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Status Messages - 重新规划到Summary Bar下方 */}
        {(error || success || loading) && (
          <div className="mb-4">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <div className="flex items-center gap-2">
                  <span>{error}</span>
                </div>
              </div>
            )}
            {success && !error && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <div className="flex items-center gap-2">
                  <span>{success}</span>
                </div>
              </div>
            )}
            {loading && !error && !success && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300/30 border-t-blue-300" />
                  <span>正在查询包裹信息...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 内容卡片区域 */}
        <div className="yogo-panel mx-auto mb-4 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl p-4">
          <div className="relative h-full overflow-y-auto">
            {/* 上下箱包裹分组展示 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  上箱
                </div>
                <div className="flex min-h-[56px] flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/45 p-3 text-base text-slate-100">
                  {info && info.upperPackages.length > 0 ? (
                    info.upperPackages.map((id) => (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-1 font-mono text-blue-100 transition-colors hover:bg-blue-500/18"
                      >
                        <span>{id}</span>
                        <button
                          type="button"
                          onClick={() => handleClearSingleRequest(id)}
                          disabled={clearingPackages.has(id) || clearing}
                          className="rounded-full p-1 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          title={`清空包裹 ${id}`}
                          aria-label={`清空包裹 ${id}`}
                        >
                          {clearingPackages.has(id) ? (
                            <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          ) : (
                            <svg
                              className="w-3 h-3 text-red-400"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500">无</span>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  下箱
                </div>
                <div className="flex min-h-[56px] flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/45 p-3 text-base text-slate-100">
                  {info && info.lowerPackages.length > 0 ? (
                    info.lowerPackages.map((id) => (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-1 font-mono text-blue-100 transition-colors hover:bg-blue-500/18"
                      >
                        <span>{id}</span>
                        <button
                          type="button"
                          onClick={() => handleClearSingleRequest(id)}
                          disabled={clearingPackages.has(id) || clearing}
                          className="rounded-full p-1 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          title={`清空包裹 ${id}`}
                          aria-label={`清空包裹 ${id}`}
                        >
                          {clearingPackages.has(id) ? (
                            <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          ) : (
                            <svg
                              className="w-3 h-3 text-red-400"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500">无</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* 操作按钮区域 - 固定在卡片底部 */}
        </div>

        {/* 清空全部包裹按钮 - 移到卡片外层 */}
        {info && info.totalCount > 0 && (
          <button
            type="button"
            onClick={handleClearRequest}
            disabled={clearing || loading}
            className="yogo-button-danger flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {clearing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>清空中...</span>
              </>
            ) : (
              <span>清空全部包裹</span>
            )}
          </button>
        )}
      </div>

      {/* 确认对话框 */}
      {showConfirmDialog && confirmAction && (
        <div className="yogo-modal-overlay z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm [-webkit-app-region:no-drag]">
          <div className="yogo-panel mx-4 w-full max-w-md rounded-3xl p-6">
            <div className="text-center">
              <h3 className="mb-3 text-xl font-bold text-slate-100">
                确认操作
              </h3>
              <p className="mb-6 text-slate-300">{confirmAction.message}</p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="yogo-button-secondary rounded-lg px-6 py-2 transition"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="yogo-button-danger rounded-lg px-6 py-2 transition"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackageManager;
