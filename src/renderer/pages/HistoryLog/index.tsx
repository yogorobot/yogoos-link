import { useEffect, useState } from 'react';
import StreamView from '../../components/StreamView';
import { useLog } from '../../hooks';
import { FilterOptions } from '../../components/StreamView/LogFilter';

const defaultFilters: FilterOptions = {
  searchTerm: '[Face]',
  caseSensitive: true,
  customPattern: '',
  excludeTerms: [],
};

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
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const [time, setTime] = useState<number>(Date.now());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const onFilterChange = (filter: FilterOptions) => {
    setFilters(filter);
    setTime(Date.now());
  };

  const handleSelectHistoryLog = (item) => {
    setSelectedFile(item);
  };

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const logs = await getHistoryLogList();

      if (!logs || logs.length === 0) {
        setError('未找到日志文件，请检查SSH连接状态');
        setLogList([]);
        setSelectedFile(null);
      } else {
        setLogList(logs);
        setSelectedFile(logs[0]);
        setError(null);
      }
    } catch (err) {
      console.error('获取日志列表失败:', err);
      const errorMsg = err?.message || '获取日志列表失败';

      if (
        errorMsg.includes('SSH连接未建立') ||
        errorMsg.includes('No response from server')
      ) {
        setError('SSH连接已断开，请重新建立连接');
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
  };

  // 自动加载机制
  useEffect(() => {
    fetchLogs();
  }, []);

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
    <div className="w-full h-full bg-gray-900/85 backdrop-blur-xl flex">
      <div className="flex h-full w-full min-h-0">
        {/* 左侧文件列表 - 可折叠 */}
        <div
          className={`flex-shrink-0 bg-white/5 border-r border-white/10 flex flex-col h-full backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden ${
            sidebarCollapsed ? 'w-0' : 'w-80'
          }`}
        >
          {/* 头部标题 */}
          <div className="p-4 border-b border-white/10 flex-shrink-0 min-w-[320px]">
            <div className="text-center mb-3">
              <h2 className="text-xl font-semibold text-white mb-1">
                历史日志
              </h2>
              <p className="text-xs text-white/60">
                {error ? '加载失败' : `${logList.length} 个日志文件`}
              </p>
            </div>
          </div>

          {/* 文件列表 */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0 min-w-[320px]">
            {(() => {
              if (isLoading) {
                return (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-8 h-8 border-2 border-white/30 border-t-indigo-500 rounded-full animate-spin" />
                      <span className="text-sm text-white/60">加载中...</span>
                    </div>
                  </div>
                );
              }

              if (error) {
                return (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-red-500/15 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">
                        连接失败
                      </h3>
                      <p className="text-sm text-white/60 mb-4 leading-relaxed">
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
                      <div className="w-16 h-16 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">📝</span>
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">
                        暂无日志文件
                      </h3>
                      <p className="text-sm text-white/60">
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
                      <div
                        key={fileName}
                        className={`cursor-pointer transition-all duration-300 rounded-xl border backdrop-blur-sm ${
                          isSelected
                            ? 'bg-indigo-500/20 border-indigo-500/40 shadow-lg'
                            : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                        }`}
                        onClick={() => handleSelectHistoryLog(file)}
                      >
                        <div className="p-4">
                          <div className="mb-3">
                            <h3
                              className={`text-sm font-semibold leading-relaxed break-words ${
                                isSelected ? 'text-white' : 'text-white/95'
                              }`}
                            >
                              {fileName}
                            </h3>
                            <p
                              className={`text-xs mt-1 font-mono ${
                                isSelected
                                  ? 'text-indigo-200/80'
                                  : 'text-white/60'
                              }`}
                            >
                              {file.name}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
                              <span>📅</span>
                              <span className="font-medium text-white/80">
                                {file.date.split(' ').slice(0, 2).join(' ')}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
                              <span>📊</span>
                              <span className="font-medium text-white/80">
                                {(Number(file.size) / 1024 / 1024).toFixed(1)}
                                MB
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* 右侧内容区域 */}
        <div className="flex-1 bg-white/5 backdrop-blur-sm overflow-hidden">
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
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">{error ? '❌' : '📜'}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {error ? '连接失败' : '选择日志文件'}
                </h3>
                <p className="text-sm text-white/70 mb-6">
                  {error
                    ? '请检查SSH连接状态'
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
