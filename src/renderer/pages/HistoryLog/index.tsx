import { useCallback, useEffect, useState } from 'react';
import StreamView from '../../components/StreamView';
import WindowTitlebar from '../../components/WindowTitlebar';
import { useLog } from '../../hooks';
import { FilterOptions } from '../../components/StreamView/LogFilter';

const getDefaultFilters = (fileName?: string): FilterOptions => ({
  searchTerm: fileName?.includes('macross') ? 'face_log' : '[Face]',
  caseSensitive: true,
  customPattern: '',
  excludeTerms: [],
});

const getHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = hash * 33 + char;
    // 确保hash是32位整数
    hash = Math.abs(hash) % 0x80000000;
  }
  return hash.toString(16);
};

const Index = () => {
  const [logList, setLogList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { getHistoryLogList } = useLog();
  const [requestId, setRequestId] = useState<string>(null);
  const [defaultFilters, setDefaultFilters] =
    useState<FilterOptions>(getDefaultFilters());
  const [filters, setFilters] = useState<FilterOptions>(getDefaultFilters());
  const [time, setTime] = useState<number>(Date.now());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const onFilterChange = (filter: FilterOptions) => {
    setFilters(filter);
    setTime(Date.now());
  };

  const handleSelectHistoryLog = (item) => {
    setSelectedFile(item);
    setIsSidebarOpen(false);
  };

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const logs = await getHistoryLogList();

      if (!logs || logs.length === 0) {
        setError('未找到日志文件，请检查连接状态');
        setLogList([]);
        setSelectedFile(null);
      } else {
        setLogList(logs);
        const initialFile = logs[0];
        const initialFilters = getDefaultFilters(initialFile.name);
        setDefaultFilters(initialFilters);
        setFilters(initialFilters);
        setSelectedFile(initialFile);
        setError(null);
      }
    } catch (err: any) {
      console.error('获取日志列表失败:', err);
      const errorMsg = err?.message || '获取日志列表失败';

      if (
        errorMsg.includes('SSH连接未建立') ||
        errorMsg.includes('No response from server')
      ) {
        setError('连接已断开，请重新建立连接');
      } else if (errorMsg.includes('EADDRNOTAVAIL')) {
        setError('网络连接不可用，请检查网络设置');
      } else {
        setError(errorMsg);
      }

      setLogList([]);
      setSelectedFile(null);
    } finally {
      setIsLoading(false);
    }
  }, [getHistoryLogList]);

  // 自动加载机制
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (selectedFile?.name) {
      const filtersHash = getHash(
        JSON.stringify({
          time,
          data: filters,
        }),
      );
      setRequestId(`${selectedFile?.name}-${filtersHash}`);
    }
  }, [selectedFile, filters, time]);

  return (
    <div className="yogo-page flex h-full w-full flex-col overflow-hidden">
      <WindowTitlebar fallbackTitle="历史日志" />
      <div
        className={`relative flex min-h-0 w-full flex-1 p-4 [-webkit-app-region:no-drag] max-sm:p-3 ${
          sidebarCollapsed ? 'gap-0' : 'gap-4'
        }`}
      >
        {isSidebarOpen && (
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 top-[var(--yogo-titlebar-safe-height)] z-30 bg-slate-950/65 backdrop-blur-sm min-[861px]:hidden"
            aria-label="关闭日志文件侧边栏"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        {/* 左侧文件列表 - 可折叠 */}
        <div
          className={`yogo-panel z-40 flex h-full flex-shrink-0 flex-col overflow-hidden rounded-3xl transition-all duration-300 ease-in-out max-[860px]:fixed max-[860px]:bottom-3 max-[860px]:left-3 max-[860px]:top-[calc(var(--yogo-titlebar-safe-height)+0.75rem)] max-[860px]:h-auto max-[860px]:w-[min(22rem,calc(100vw-1.5rem))] max-[860px]:transition-transform ${
            sidebarCollapsed
              ? 'w-0 border-0 p-0 opacity-0 max-[860px]:opacity-100'
              : 'w-80'
          } ${
            isSidebarOpen
              ? 'max-[860px]:translate-x-0'
              : 'max-[860px]:-translate-x-[calc(100%+1rem)]'
          }`}
        >
          {/* 头部标题 */}
          <div className="min-w-[320px] flex-shrink-0 border-b border-slate-800/80 p-4">
            <div className="mb-1">
              <h2 className="text-sm font-medium text-slate-300">日志文件</h2>
              <p className="mt-1 text-xs text-slate-500">
                {error ? '加载失败' : `${logList.length} 个日志文件`}
              </p>
            </div>
          </div>

          {/* 文件列表 */}
          <div className="min-h-0 min-w-[320px] flex-1 overflow-y-auto p-3">
            {(() => {
              if (isLoading) {
                return (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-300/30 border-t-blue-300" />
                      <span className="text-sm text-slate-400">加载中...</span>
                    </div>
                  </div>
                );
              }

              if (error) {
                return (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-red-500/20 bg-red-500/10" />
                      <h3 className="mb-2 text-lg font-medium text-slate-100">
                        连接失败
                      </h3>
                      <p className="mb-4 text-sm leading-relaxed text-slate-400">
                        {error}
                      </p>
                    </div>
                  </div>
                );
              }

              if (logList.length === 0) {
                return (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-slate-700 bg-slate-900/70" />
                      <h3 className="mb-2 text-lg font-medium text-slate-100">
                        暂无日志文件
                      </h3>
                      <p className="text-sm text-slate-400">
                        服务器上没有找到历史日志文件
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {logList?.map((file) => {
                    const isSelected = selectedFile?.name === file.name;
                    const fileName = file.name.split('/').slice(-1)[0];

                    return (
                      <button
                        type="button"
                        key={fileName}
                        className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
                          isSelected
                            ? 'border-blue-400/60 bg-blue-500/12'
                            : 'border-slate-800 bg-slate-950/35 hover:border-slate-700 hover:bg-slate-900/70'
                        }`}
                        onClick={() => handleSelectHistoryLog(file)}
                      >
                        <div className="mb-3">
                          <h3
                            className={`break-words text-sm font-semibold leading-relaxed ${
                              isSelected ? 'text-slate-100' : 'text-slate-200'
                            }`}
                          >
                            {fileName}
                          </h3>
                          <p className="mt-1 break-all font-mono text-xs text-slate-500">
                            {file.name}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1">
                            {file.date.split(' ').slice(0, 2).join(' ')}
                          </span>
                          <span className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1">
                            {(Number(file.size) / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* 右侧内容区域 */}
        <div className="yogo-panel min-h-0 flex-1 overflow-hidden rounded-3xl">
          {requestId ? (
            <StreamView
              key={requestId}
              type="history"
              filters={filters}
              defaultFilters={defaultFilters}
              onFilterChange={onFilterChange}
              requestId={requestId}
              sidebarCollapsed={sidebarCollapsed}
              onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              onMobileSidebarToggle={() => setIsSidebarOpen(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-slate-700 bg-slate-900/70" />
                <h3 className="mb-3 text-xl font-semibold text-slate-100">
                  {error ? '连接失败' : '选择日志文件'}
                </h3>
                <p className="mb-6 text-sm text-slate-400">
                  {error
                    ? '请检查连接状态'
                    : '从左侧列表中选择一个日志文件来查看内容'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
