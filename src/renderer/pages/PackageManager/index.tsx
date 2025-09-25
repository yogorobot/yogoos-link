import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    <div className="flex flex-col w-full h-full max-w-none from-gray-900 via-indigo-900/20 shadow-2xl relative overflow-hidden">
      <style>{`
        @keyframes sweep {
          0% { transform: translateX(-100%) skew(12deg); opacity: 0; }
          50% { transform: translateX(0%) skew(12deg); opacity: 1; }
          100% { transform: translateX(100%) skew(12deg); opacity: 0; }
        }
      `}</style>
      {/* 动态背景效果 */}
      <div className="absolute inset-0 opacity-30 pointer-events-none select-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-full filter blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full filter blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-pink-500/20 to-indigo-500/20 rounded-full filter blur-2xl" />
      </div>
      {/* 网格背景 */}
      <div className="absolute inset-0 opacity-5 pointer-events-none select-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
      </div>
      {/* 主要内容区域 */}
      <div className="relative z-10 flex-1 flex flex-col px-6 py-4 overflow-y-auto">
        {/* 页面标题区域 */}
        <div className="relative text-center mb-6">
          {/* 上方光晕效果 */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4 w-32 h-1 bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent rounded-full blur-sm" />
          {/* 主标题与特效 */}
          <div className="relative">
            {/* 背景光晕 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-cyan-500/30 bg-clip-text blur-3xl">
                机器人包裹
              </div>
            </div>
            {/* 主标题 */}
            <h1 className="relative text-2xl font-black mb-2 italic transform -skew-x-6 drop-shadow-2xl overflow-hidden">
              <span className="relative bg-gradient-to-r from-indigo-300 via-purple-200 to-cyan-300 bg-clip-text text-transparent">
                📦 机器人包裹
                {/* 灯光扫射效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 animate-[sweep_3s_ease-in-out_infinite] transform skew-x-6 w-full">
                  <div className="w-full h-full bg-gradient-to-r from-transparent via-white/60 to-transparent blur-sm" />
                </div>
                {/* 额外发光层 */}
                <div className="absolute inset-0 text-2xl font-black bg-gradient-to-r from-white/20 via-white/40 to-white/20 bg-clip-text text-transparent animate-pulse">
                  📦 机器人包裹
                </div>
              </span>
            </h1>
            {/* 下方光晕 */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent rounded-full blur-sm" />
          </div>

          {/* 状态信息区域 */}
          <div className="mt-3">
            <p className="text-white/70 text-sm">
              每5秒自动刷新
              {lastRefreshTime && (
                <>
                  {' | '}
                  <span className="text-white/50">
                    上次更新: {lastRefreshTime.toLocaleTimeString()}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Summary Bar - 移到卡片区域上方 */}
        <div className="flex justify-between items-center p-4 mb-4 bg-white/10 rounded-xl backdrop-blur-xl border border-white/20 shadow-lg">
          <div className="flex items-center gap-4">
            <span className="text-white/80 text-base">包裹总数：</span>
            <span className="font-bold text-3xl text-cyan-300 tabular-nums">
              {loading && !info ? '-' : (info?.totalCount ?? '0')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={loading || clearing}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            title="手动刷新"
            aria-label="手动刷新包裹信息"
          >
            <svg
              className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`}
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

        {/* Status Messages - 重新规划到Summary Bar下方 */}
        {(error || success || loading) && (
          <div className="mb-4">
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-3 border border-red-500/20 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <span className="text-lg">❌</span>
                  <span>{error}</span>
                </div>
              </div>
            )}
            {success && !error && (
              <div className="text-green-400 text-sm bg-green-500/10 rounded-lg px-4 py-3 border border-green-500/20 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <span>{success}</span>
                </div>
              </div>
            )}
            {loading && !error && !success && (
              <div className="text-cyan-300 text-sm bg-cyan-500/10 rounded-lg px-4 py-3 border border-cyan-500/20 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
                  <span>正在查询包裹信息...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 内容卡片区域 */}
        <div className="mb-4 flex-1 flex flex-col p-4 bg-white/5 border border-white/20 rounded-2xl backdrop-blur-xl shadow-2xl hover:bg-white/[0.07] transition-all duration-300 relative overflow-hidden min-h-0 w-full mx-auto">
          {/* 背景装饰元素 */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl" />
          {/* 内部光晕 */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.04] pointer-events-none" />
          <div className="relative h-full overflow-y-auto">
            {/* 上下箱包裹分组展示 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-cyan-200 font-semibold mb-2 text-lg flex items-center gap-2">
                  上箱
                </div>
                <div className="bg-gray-900/80 rounded-xl p-3 min-h-[56px] text-cyan-100 text-base flex flex-wrap gap-2">
                  {info && info.upperPackages.length > 0 ? (
                    info.upperPackages.map((id) => (
                      <div
                        key={id}
                        className="bg-cyan-700/30 px-3 py-1 rounded text-cyan-100 font-mono flex items-center gap-2 hover:bg-cyan-700/50 transition-colors"
                      >
                        <span>{id}</span>
                        <button
                          type="button"
                          onClick={() => handleClearSingleRequest(id)}
                          disabled={clearingPackages.has(id) || clearing}
                          className="p-1 rounded-full hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    <span className="text-gray-500">无</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-cyan-200 font-semibold mb-2 text-lg flex items-center gap-2">
                  下箱
                </div>
                <div className="bg-gray-900/80 rounded-xl p-3 min-h-[56px] text-cyan-100 text-base flex flex-wrap gap-2">
                  {info && info.lowerPackages.length > 0 ? (
                    info.lowerPackages.map((id) => (
                      <div
                        key={id}
                        className="bg-cyan-700/30 px-3 py-1 rounded text-cyan-100 font-mono flex items-center gap-2 hover:bg-cyan-700/50 transition-colors"
                      >
                        <span>{id}</span>
                        <button
                          type="button"
                          onClick={() => handleClearSingleRequest(id)}
                          disabled={clearingPackages.has(id) || clearing}
                          className="p-1 rounded-full hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    <span className="text-gray-500">无</span>
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
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-70 disabled:cursor-not-allowed border-none rounded-xl px-6 py-3 text-white text-base font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:transform-none relative overflow-hidden"
          >
            {clearing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>清空中...</span>
              </>
            ) : (
              <>
                <span>🗑️</span>
                <span>清空全部包裹</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 确认对话框 */}
      {showConfirmDialog && confirmAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900/95 border border-white/20 rounded-2xl p-6 max-w-md w-full mx-4 backdrop-blur-xl shadow-2xl">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-3">确认操作</h3>
              <p className="text-gray-300 mb-6">{confirmAction.message}</p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
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
