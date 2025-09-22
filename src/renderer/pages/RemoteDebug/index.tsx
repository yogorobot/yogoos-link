import React, { useState } from 'react';
import { useDebug } from '../../hooks';
import { useToast } from '../../components/NotificationProvider';

const Index = () => {
  const { debugConnect, debugDisconnect } = useDebug();
  const { showSuccess, showError } = useToast();
  const [isExecuting, setIsExecuting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devToolsUrl, setDevToolsUrl] = useState(null);

  const handleCommandSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const formValues = Object.fromEntries(formData.entries());
    const submitter = event.nativeEvent?.submitter;

    if (submitter?.value === 'debug:connect') {
      setIsExecuting(true);
      setLoading(true);
      try {
        const result = await debugConnect(formValues);
        if (result.success) {
          setDevToolsUrl(result.data);
          showSuccess('调试连接成功');
        } else {
          const errorMsg = result.error || '调试连接失败';
          showError(`调试连接失败: ${errorMsg}`);
        }
        setIsExecuting(false);
        // setLoading(false);
      } catch (error) {
        showError(`调试连接失败: ${error.message || '未知错误'}`);
        setIsExecuting(false);
        setLoading(false);
      }
    } else if (submitter?.value === 'debug:disconnect') {
      // 处理断开调试命令
      setIsExecuting(true);
      try {
        const result = await debugDisconnect(formValues);
        if (result.success) {
          setDevToolsUrl(null);
          showSuccess('调试断开成功');
        } else {
          showError(result.error || '断开调试连接失败');
        }
      } catch (error) {
        showError(`断开调试连接失败: ${error.message || '未知错误'}`);
      } finally {
        setIsExecuting(false);
      }
    }
  };

  return (
    <div className="h-full w-full bg-transparent flex flex-col min-h-0">
      <div className="w-full bg-gray-900/85 p-2 backdrop-blur-xl border border-white/10 shadow-2xl flex-shrink-0">
        <div className="space-y-3">
          {/* <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6"> */}
          <form
            action="#"
            className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4"
            id="remote-debug-form"
            onSubmit={handleCommandSubmit}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
              <label
                htmlFor="proxy-port"
                className="text-xs font-medium text-white/90 whitespace-nowrap min-w-fit"
              >
                local-Port:
              </label>
              <input
                type="number"
                id="local-port"
                name="local-port"
                defaultValue="9223"
                disabled={isExecuting || !!devToolsUrl}
                placeholder="隧道端口"
                className="w-full sm:w-20 lg:w-24 bg-white/8 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/60 focus:bg-white/12 transition-all font-mono"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
              <label
                htmlFor="debugging-port"
                className="text-xs font-medium text-white/90 whitespace-nowrap min-w-fit"
              >
                Debugging-Port:
              </label>
              <input
                type="number"
                id="remote-port"
                name="remote-port"
                defaultValue="8315"
                disabled={isExecuting || !!devToolsUrl}
                placeholder="端口"
                className="w-full sm:w-20 lg:w-24 bg-white/8 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/60 focus:bg-white/12 transition-all font-mono"
              />
            </div>
            <div className="lg:flex-1" />
            {(() => {
              if (isExecuting) {
                return (
                  <button
                    type="submit"
                    disabled={isExecuting}
                    className="w-full lg:w-auto lg:flex-shrink-0 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-xl transition-all whitespace-nowrap text-xs"
                  >
                    执行中...
                  </button>
                );
              }
              if (devToolsUrl) {
                return (
                  <button
                    type="submit"
                    value="debug:disconnect"
                    className="w-full lg:w-auto lg:flex-shrink-0 bg-red-600/80 hover:bg-red-600 text-white px-4 py-1.5 rounded-xl transition-all whitespace-nowrap text-xs"
                  >
                    断开调试
                  </button>
                );
              }
              return null;
            })()}
          </form>
          {/* </div> */}
        </div>
      </div>
      {/* 调试视口 */}
      <div className="w-full bg-gray-900/85 backdrop-blur-xl shadow-2xl flex-1 overflow-hidden min-h-0">
        {(() => {
          if (devToolsUrl) {
            return (
              <div className="w-full h-full relative">
                <iframe
                  src={devToolsUrl}
                  onLoad={() => setLoading(false)}
                  className="w-full h-full"
                  style={{ border: 'none' }}
                  title="Remote Debugging View"
                />
                {loading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center">
                    <p className="text-sm text-white/70">即将加载完毕...</p>
                  </div>
                )}
              </div>
            );
          }

          if (isExecuting) {
            return (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-white/70">正在连接调试服务...</p>
              </div>
            );
          }

          return (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-sm text-white/70 mb-3">
                未连接到调试服务, 请点击开始调试
              </p>
              <button
                type="submit"
                form="remote-debug-form"
                value="debug:connect"
                disabled={isExecuting}
                className="bg-indigo-600/80 hover:bg-indigo-600 text-white px-8 py-3 rounded-xl transition-all whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                开始调试
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Index;
