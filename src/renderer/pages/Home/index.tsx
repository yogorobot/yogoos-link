import { useEffect, useState } from 'react';
import { BrowserWindowConstructorOptions } from 'electron';
import { useWindow, useSSH, useSystem } from '../../hooks';
import { AuthInfo } from '../../../main/preload';

const Index = () => {
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const { getCurrentWindowInfo, createWindow } = useWindow();
  const { disconnect } = useSSH();
  const { systemReboot } = useSystem();

  useEffect(() => {
    const fetchAuthInfo = async () => {
      const { data } = await getCurrentWindowInfo();
      setAuthInfo(data?.authInfo);
    };

    fetchAuthInfo();
  }, [getCurrentWindowInfo]);

  const openChildWindow = async (
    filePath: string,
    options?: BrowserWindowConstructorOptions,
  ) => {
    if (!authInfo) return;

    setIsLoading(true);
    try {
      const result = await createWindow(filePath, options);
      if (!result.success) {
        // eslint-disable-next-line no-alert
        alert(`打开窗口失败: ${result.error}`);
      }
    } catch (openError) {
      // eslint-disable-next-line no-console
      console.error('打开子窗口错误:', openError);
      // eslint-disable-next-line no-alert
      alert('打开窗口时发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSystemReboot = async () => {
    if (!authInfo) return;

    setIsRebooting(true);
    try {
      const result = await systemReboot();
      if (result.success) {
        // eslint-disable-next-line no-alert
        alert('系统重启命令已发送');
      } else if (result.canceled) {
        // 用户取消了操作，不显示错误
      } else {
        // eslint-disable-next-line no-alert
        alert(`系统重启失败: ${result.error}`);
      }
    } catch (rebootError) {
      // eslint-disable-next-line no-console
      console.error('系统重启错误:', rebootError);
      // eslint-disable-next-line no-alert
      alert('系统重启时发生错误');
    } finally {
      setIsRebooting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bg-gray-900/85 backdrop-blur-xl flex-1 p-8 overflow-y-auto">
        {/* 主要内容区域 */}
        {/* <div className=""> */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* 实时日志查询 */}
          <div className="group relative bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 rounded-2xl p-6 border border-indigo-500/20 hover:border-indigo-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-white text-xl">📋</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    实时日志
                  </h2>
                  <p className="text-indigo-300/80 text-xs font-medium">
                    实时监控
                  </p>
                </div>
              </div>
              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                实时查看和分析系统日志，监控应用运行状态
              </p>
              <button
                type="button"
                onClick={() =>
                  openChildWindow('log-real-time-viewer', { resizable: true })
                }
                disabled={!authInfo || isLoading}
                className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
              >
                {isLoading ? '正在打开...' : '查看日志'}
              </button>
            </div>
          </div>

          {/* 历史日志查询 */}
          <div className="group relative bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-2xl p-6 border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-white text-xl">📊</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    历史日志
                  </h2>
                  <p className="text-purple-300/80 text-xs font-medium">
                    数据分析
                  </p>
                </div>
              </div>
              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                查看历史日志文件，分析系统问题和性能趋势
              </p>
              <button
                type="button"
                onClick={() =>
                  openChildWindow('log-history-viewer', { resizable: true })
                }
                disabled={!authInfo || isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
              >
                {isLoading ? '正在打开...' : '查看日志'}
              </button>
            </div>
          </div>

          {/* 远程调试 */}
          <div className="group relative bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-2xl p-6 border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-white text-xl">🔧</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    远程调试
                  </h2>
                  <p className="text-emerald-300/80 text-xs font-medium">
                    问题排查
                  </p>
                </div>
              </div>
              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                远程应用调试和问题排查，实时监控应用状态
              </p>
              <button
                type="button"
                onClick={() =>
                  openChildWindow('remote-debug', { resizable: true })
                }
                disabled={!authInfo || isLoading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
              >
                {isLoading ? '正在打开...' : '开始调试'}
              </button>
            </div>
          </div>

          {/* UI应用升级 */}
          <div className="group relative bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-2xl p-6 border border-amber-500/20 hover:border-amber-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-white text-xl">⬆️</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    UI应用升级
                  </h2>
                  <p className="text-amber-300/80 text-xs font-medium">
                    页面更新
                  </p>
                </div>
              </div>
              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                保持UI应用最新状态
              </p>
              <button
                type="button"
                onClick={() =>
                  openChildWindow('app-update', {
                    width: 500,
                    height: 650,
                  })
                }
                disabled={!authInfo || isLoading}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
              >
                {isLoading ? '正在打开...' : '手动升级'}
              </button>
            </div>
          </div>

          {/* 应用设置 */}
          <div className="group relative bg-gradient-to-br from-slate-500/10 to-slate-600/5 rounded-2xl p-6 border border-slate-500/20 hover:border-slate-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-slate-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-white text-xl">⚙️</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    应用切换
                  </h2>
                  <p className="text-slate-300/80 text-xs font-medium">功能</p>
                </div>
              </div>
              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                配置启动脚本，切换不同应用
              </p>
              <button
                type="button"
                onClick={() =>
                  openChildWindow('app-switch', {
                    width: 500,
                    height: 750,
                  })
                }
                disabled={!authInfo || isLoading}
                className="w-full bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
              >
                {isLoading ? '正在打开...' : '打开设置'}
              </button>
            </div>
          </div>
          {/* 机器人包裹 */}
          <div className="group relative bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-2xl p-6 border border-cyan-500/20 hover:border-cyan-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-white text-xl">📦</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    机器人包裹
                  </h2>
                  <p className="text-cyan-300/80 text-xs font-medium">
                    查看/清空包裹
                  </p>
                </div>
              </div>
              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                查看机器人当前包裹内容，支持一键清空。
              </p>
              <button
                type="button"
                onClick={() =>
                  openChildWindow('package-manager', {
                    width: 500,
                    height: 650,
                  })
                }
                disabled={!authInfo || isLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
              >
                {isLoading ? '正在打开...' : '查看包裹'}
              </button>
            </div>
          </div>

          {/* 设备存储 */}
          <div className="group relative bg-gradient-to-br from-sky-500/10 to-sky-600/5 rounded-2xl p-6 border border-sky-500/20 hover:border-sky-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-white text-xl">💾</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    设备存储
                  </h2>
                  <p className="text-sky-300/80 text-xs font-medium">
                    磁盘空间监控
                  </p>
                </div>
              </div>
              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                查看远程设备的磁盘使用情况和可用空间。
              </p>
              <button
                type="button"
                onClick={() =>
                  openChildWindow('storage-viewer', {
                    height: 600,
                  })
                }
                disabled={!authInfo || isLoading}
                className="w-full bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
              >
                {isLoading ? '正在打开...' : '查看存储'}
              </button>
            </div>
          </div>

          {/* 系统重启 */}
          <div className="group relative bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-2xl p-6 border border-red-500/20 hover:border-red-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-white text-xl">🔄</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-1">
                    系统重启
                  </h2>
                  <p className="text-red-300/80 text-xs font-medium">
                    系统控制
                  </p>
                </div>
              </div>
              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                重启远程系统，将断开所有连接并重新启动
              </p>
              <button
                type="button"
                onClick={handleSystemReboot}
                disabled={!authInfo || isRebooting}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none"
              >
                {isRebooting ? '正在重启...' : '系统重启'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* 操作按钮区域 */}
      {authInfo && (
        <div className="flex-shrink-0 p-6 border-t border-white/10">
          {/* <div className="text-center"> */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div className="text-left">
                <div className="text-white/80 text-sm font-medium">
                  已连接到 {authInfo.host}:{authInfo.port}
                </div>
                {authInfo.useJumpHost && authInfo.jumpHost && (
                  <div className="text-white/60 text-xs mt-1">
                    通过跳板机: {authInfo.jumpUsername}@{authInfo.jumpHost}:
                    {authInfo.jumpPort}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                // eslint-disable-next-line no-alert
                if (window.confirm('您确定要断开连接吗？')) {
                  try {
                    await disconnect();
                    // 强制登出会自动处理窗口跳转和清理
                  } catch (disconnectError) {
                    // eslint-disable-next-line no-console
                    console.error('断开连接错误:', disconnectError);
                    // eslint-disable-next-line no-alert
                    alert('断开连接失败');
                  }
                }
              }}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-2 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] text-sm font-medium"
            >
              <span className="text-sm">🔌</span>
              断开连接
            </button>
          </div>
        </div>
        // </div>
      )}
    </div>
  );
};

export default Index;
