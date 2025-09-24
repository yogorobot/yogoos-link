import React, { useState, useEffect } from 'react';
import { usePackage } from '../../hooks/usePackage';

const PackageManager: React.FC = () => {
  const { packageQuery, packageClear } = usePackage();
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{
    upperPackages: number[];
    lowerPackages: number[];
    totalCount: number;
  } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await packageQuery();
        setInfo(res);
        if (res.totalCount === 0) {
          setSuccess('当前包裹为空');
        }
      } catch (e: any) {
        setError(e.message || '查询失败');
        setInfo(null);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = async () => {
    if (!info || info.totalCount === 0) return;
    setClearing(true);
    setError(null);
    setSuccess(null);
    try {
      const cleared = await packageClear();
      setSuccess(cleared ? '包裹清理成功' : '包裹清理失败');
      // 重新查询
      const res = await packageQuery();
      setInfo(res);
    } catch (e: any) {
      setError(e.message || '清理失败');
    } finally {
      setClearing(false);
    }
  };

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
      <div className="relative z-10 flex-1 flex flex-col p-6 overflow-y-auto">
        {/* 页面标题区域 */}
        <div className="relative text-center mb-8">
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
          <p className="text-white/70 text-sm font-normal mt-2 tracking-wide">
            实时查看机器人上下箱包裹，支持一键清空
          </p>
        </div>
        {/* 内容卡片区域 */}
        <div className="flex-1 flex flex-col space-y-6 p-6 bg-white/5 border border-white/20 rounded-2xl backdrop-blur-xl shadow-2xl hover:bg-white/[0.07] transition-all duration-300 relative overflow-hidden min-h-0 w-full mx-auto">
          {/* 背景装饰元素 */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl" />
          {/* 内部光晕 */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.04] pointer-events-none" />
          <div className="relative space-y-6 h-full overflow-y-auto">
            {/* 机器人信息与状态 */}
            <div className="mb-2 text-white/80 text-base">
              包裹总数：
              <span className="font-bold text-cyan-300">
                {info?.totalCount ?? '-'}
              </span>
            </div>
            {error && <div className="mb-3 text-red-400 text-sm">{error}</div>}
            {success && (
              <div className="mb-3 text-green-400 text-sm">{success}</div>
            )}
            {loading && (
              <div className="text-cyan-100 py-4 text-center">查询中...</div>
            )}
            {/* 上下箱包裹分组展示 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-cyan-200 font-semibold mb-2 text-lg flex items-center gap-2">
                  上箱
                </div>
                <div className="bg-gray-900/80 rounded-xl p-4 min-h-[56px] text-cyan-100 text-base flex flex-wrap gap-2">
                  {info && info.upperPackages.length > 0 ? (
                    info.upperPackages.map((id) => (
                      <span
                        key={id}
                        className="bg-cyan-700/30 px-3 py-1 rounded text-cyan-100 font-mono"
                      >
                        {id}
                      </span>
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
                <div className="bg-gray-900/80 rounded-xl p-4 min-h-[56px] text-cyan-100 text-base flex flex-wrap gap-2">
                  {info && info.lowerPackages.length > 0 ? (
                    info.lowerPackages.map((id) => (
                      <span
                        key={id}
                        className="bg-cyan-700/30 px-3 py-1 rounded text-cyan-100 font-mono"
                      >
                        {id}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">无</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* 操作按钮区域 - 固定在卡片底部 */}
          <div className="flex-shrink-0 pt-4">
            {info && info.totalCount !== 0 && (
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing || loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-70 disabled:cursor-not-allowed border-none rounded-xl px-6 py-3 text-white text-base font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:transform-none relative overflow-hidden"
              >
                {clearing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>清空中...</span>
                  </>
                ) : (
                  <>
                    <span>🗑️</span>
                    <span>清空包裹</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageManager;
