import { useState, useEffect } from 'react';
import { useApp } from '../../hooks';
import { useToast } from '../../components/NotificationProvider';
import type { AppSwitchProgress } from '../../hooks/useApp';

interface AppSwitchOptions {
  selectedApp?: string;
}

const Index = () => {
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchOptions, setSwitchOptions] = useState<AppSwitchOptions>({});
  const [progress, setProgress] = useState<AppSwitchProgress | null>(null);
  const { onSwitchProgress, switchApp, getCurrentApp } = useApp();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    const fetchCurrentApp = async () => {
      const config = await getCurrentApp();

      setSwitchOptions((prev) => ({
        ...prev,
        selectedApp: config.currentApp,
      }));
    };

    fetchCurrentApp();
  }, [getCurrentApp]);

  // 监听切换进度
  useEffect(() => {
    const unsubscribe = onSwitchProgress((progressData: AppSwitchProgress) => {
      setProgress(progressData);

      // 如果完成或出错，重置状态
      if (
        progressData.stage === 'completed' ||
        progressData.stage === 'error'
      ) {
        setIsSwitching(false);
        if (progressData.stage === 'completed') {
          showSuccess('应用切换完成');
        } else if (progressData.stage === 'error') {
          showError(progressData.message);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onSwitchProgress, showSuccess, showError]);

  const handleSwitchApp = async () => {
    if (!switchOptions.selectedApp || switchOptions.selectedApp.trim() === '') {
      showError('请选择或输入应用名称');
      return;
    }

    setIsSwitching(true);
    setProgress(null);

    try {
      const result = await switchApp({
        selectedApp: switchOptions.selectedApp,
      });

      if (!result.success) {
        setIsSwitching(false);
        showError(result.error || '应用切换失败');
      }
    } catch (error) {
      setIsSwitching(false);
      showError(error instanceof Error ? error.message : '应用切换失败');
    }
  };

  const quickSelectApp = (app: string) => {
    setSwitchOptions((prev) => ({
      ...prev,
      selectedApp: app,
    }));
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
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-full filter blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full filter blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-pink-500/20 to-indigo-500/20 rounded-full filter blur-2xl" />
      </div>

      {/* 网格背景 */}
      <div className="absolute inset-0 opacity-5">
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
              <div className="text-4xl font-bold bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-cyan-500/30 bg-clip-text blur-3xl">
                应用切换
              </div>
            </div>

            {/* 主标题 */}
            <h1 className="relative text-3xl font-black mb-2 italic transform -skew-x-6 drop-shadow-2xl overflow-hidden">
              <span className="relative bg-gradient-to-r from-indigo-300 via-purple-200 to-cyan-300 bg-clip-text text-transparent">
                🔄 应用切换
                {/* 灯光扫射效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 animate-[sweep_3s_ease-in-out_infinite] transform skew-x-6 w-full">
                  <div className="w-full h-full bg-gradient-to-r from-transparent via-white/60 to-transparent blur-sm" />
                </div>
                {/* 额外发光层 */}
                <div className="absolute inset-0 text-3xl font-black bg-gradient-to-r from-white/20 via-white/40 to-white/20 bg-clip-text text-transparent animate-pulse">
                  🔄 应用切换
                </div>
              </span>
            </h1>

            {/* 下方光晕 */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent rounded-full blur-sm" />
          </div>

          <p className="text-white/70 text-sm font-normal mt-2 tracking-wide">
            选择要切换的应用程序，支持快速选择常用应用
          </p>
        </div>

        {/* 主要内容区域 - 可滚动 */}
        <div className="flex-1 space-y-6 overflow-y-auto pb-4">
          {/* 应用输入区域 */}
          <div className="space-y-4 p-6 bg-white/5 border border-white/20 rounded-2xl backdrop-blur-xl shadow-2xl hover:bg-white/[0.07] transition-all duration-300 relative overflow-hidden">
            {/* 背景装饰元素 */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl" />

            {/* 内部光晕 */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.04] pointer-events-none" />

            <div className="relative space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-indigo-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                    />
                  </svg>
                  目标应用
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="selectedApp"
                    value={switchOptions.selectedApp || ''}
                    onChange={(e) =>
                      setSwitchOptions((prev) => ({
                        ...prev,
                        selectedApp: e.target.value,
                      }))
                    }
                    disabled={isSwitching}
                    placeholder="请输入应用名称..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400/60 focus:bg-white/15 transition-all duration-300 backdrop-blur-sm hover:bg-white/12 focus:shadow-lg focus:shadow-indigo-500/20 shadow-sm"
                  />
                  {switchOptions.selectedApp && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 快速应用选择区域 */}
          <div className="space-y-4 p-6 bg-white/5 border border-white/20 rounded-2xl backdrop-blur-xl shadow-2xl hover:bg-white/[0.07] transition-all duration-300 relative overflow-hidden">
            {/* 背景装饰元素 */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl" />

            {/* 内部光晕 */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.04] pointer-events-none" />

            <div className="relative space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/90 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  快速选择
                </label>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { name: 'takeaway', icon: '🍔', label: '外卖系统' },
                  { name: 'chur-ui', icon: '🎨', label: 'Chur UI' },
                  { name: 'rookie-ui', icon: '🌟', label: 'Rookie UI' },
                  { name: 'selfcheck', icon: '🔍', label: '自检系统' },
                  { name: 'setting', icon: '⚙️', label: '设置中心' },
                  { name: 'repair', icon: '🔧', label: '维修工具' },
                ].map((app) => (
                  <div key={app.name} className="relative">
                    <button
                      type="button"
                      onClick={() => quickSelectApp(app.name)}
                      disabled={isSwitching}
                      className={`group relative w-full p-4 rounded-xl border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] overflow-hidden ${
                        switchOptions.selectedApp === app.name
                          ? 'bg-indigo-500/30 border-indigo-400/60 text-white shadow-lg shadow-indigo-500/25'
                          : 'bg-white/10 border-white/20 text-white/90 hover:bg-white/15 hover:border-white/30 hover:text-white hover:shadow-lg'
                      }`}
                    >
                      {/* 按钮内部光效 */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                      <div className="relative text-center space-y-2">
                        {/* <div className="text-2xl group-hover:scale-110 transition-transform duration-300">
                          {app.icon}
                        </div> */}
                        <div className="text-sm font-medium">{app.label}</div>
                        <div className="text-xs opacity-60">{app.name}</div>
                      </div>
                    </button>

                    {switchOptions.selectedApp === app.name && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-400 rounded-full flex items-center justify-center shadow-lg z-10">
                        <span className="text-xs text-white font-bold">✓</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮区域 - 固定在底部 */}
        <div className="flex-shrink-0 pt-4">
          <button
            type="button"
            onClick={handleSwitchApp}
            disabled={isSwitching || !switchOptions.selectedApp}
            className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed border-none rounded-xl px-6 py-3 text-white text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:transform-none relative overflow-hidden"
          >
            {isSwitching ? (
              <>
                {/* 进度条背景 */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-700" />
                {/* 进度条 */}
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-400 to-indigo-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress?.percentage || 0}%` }}
                />
                {/* 按钮内容 */}
                <div className="relative z-10 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    {progress?.message} (
                    {progress?.percentage && progress.percentage % 1 === 0
                      ? `${progress.percentage}%`
                      : `${progress?.percentage?.toFixed(1) || 0}%`}
                    )
                  </span>
                </div>
              </>
            ) : (
              <div className="relative z-10 flex items-center gap-2">
                <span>🚀</span>
                <span>开始切换应用</span>
              </div>
            )}
          </button>

          {/* 提示信息 */}
          {!switchOptions.selectedApp && (
            <p className="text-white/50 text-sm text-center mt-3">
              💡 请先选择或输入应用名称
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
