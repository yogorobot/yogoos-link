import { useState, useEffect } from 'react';
import { useApp } from '../../hooks';
import { useToast } from '../../components/NotificationProvider';
import WindowTitlebar from '../../components/WindowTitlebar';
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
      const { data: config } = await getCurrentApp();

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
      const { success } = await switchApp({
        selectedApp: switchOptions.selectedApp,
      });

      if (!success) {
        setIsSwitching(false);
        showError('应用切换失败');
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
    <div className="yogo-page relative flex h-full w-full max-w-none flex-col overflow-hidden">
      <WindowTitlebar fallbackTitle="应用切换" />

      {/* 主要内容区域 */}
      <div className="relative z-10 flex flex-1 flex-col overflow-y-auto p-4 [-webkit-app-region:no-drag]">
        {/* 主要内容区域 - 可滚动 */}
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {/* 应用输入区域 */}
          <div className="yogo-panel space-y-4 rounded-3xl p-5 max-sm:p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
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
                    className="yogo-input w-full rounded-xl px-4 py-3 text-sm"
                  />
                  {switchOptions.selectedApp && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 快速应用选择区域 */}
          <div className="yogo-panel space-y-4 rounded-3xl p-5 max-sm:p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  快速选择
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { name: 'takeaway', label: '外卖系统' },
                  { name: 'chur-ui', label: 'Chur UI' },
                  { name: 'rookie-ui', label: 'Rookie UI' },
                  { name: 'selfcheck', label: '自检系统' },
                  { name: 'setting', label: '设置中心' },
                  { name: 'repair', label: '维修工具' },
                ].map((app) => (
                  <div key={app.name} className="relative">
                    <button
                      type="button"
                      onClick={() => quickSelectApp(app.name)}
                      disabled={isSwitching}
                      className={`yogo-card yogo-card-hover w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        switchOptions.selectedApp === app.name
                          ? 'border-blue-400/70 bg-blue-500/12 text-slate-100'
                          : 'text-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-slate-100">
                          {app.label}
                        </div>
                        <div className="text-xs text-slate-500">{app.name}</div>
                      </div>
                    </button>

                    {switchOptions.selectedApp === app.name && (
                      <div className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-blue-300/40 bg-blue-500/90">
                        <span className="text-xs font-bold text-blue-50">
                          ✓
                        </span>
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
            className="yogo-button-primary relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSwitching ? (
              <>
                {/* 进度条背景 */}
                <div className="absolute inset-0 bg-blue-600" />
                {/* 进度条 */}
                <div
                  className="absolute left-0 top-0 h-full bg-blue-400/70 transition-all duration-300 ease-out"
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
                <span>开始切换应用</span>
              </div>
            )}
          </button>

          {/* 提示信息 */}
          {!switchOptions.selectedApp && (
            <p className="mt-3 text-center text-sm text-slate-500">
              请先选择或输入应用名称
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
