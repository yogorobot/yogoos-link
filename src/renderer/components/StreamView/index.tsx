import { useEffect, FC, useRef, useCallback, useState } from 'react';
import { useLog } from '../../hooks';
import useTerminal from '../../hooks/useTerminal';
import LogFilter, { FilterOptions } from './LogFilter';

interface IProps {
  type: 'realtime' | 'history';
  requestId: string;
  filters: FilterOptions;
  defaultFilters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
}

const Index: FC<IProps> = ({
  requestId,
  type,
  filters: propsFilters,
  defaultFilters,
  onFilterChange,
  sidebarCollapsed,
  onSidebarToggle,
}) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<FilterOptions>(propsFilters);
  const { getHistoryLog, getRealtimeLog, clearStream } = useLog();
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    terminalInstance,
    openTerminal,
    SearchComponent,
    searchNext,
    searchPrevious,
    searchText,
    handleSearchTextChange,
    handleCaseSensitiveChange,
    caseSensitive,
    searchResults,
  } = useTerminal();
  const filtersRef = useRef<FilterOptions>(propsFilters);

  useEffect(() => {
    const unsubscribeStreamData = window.electron.ipcRenderer.on(
      `log:stream-data-${requestId}`,
      (data) => {
        terminalInstance.current?.write(data as string);
      },
    );

    return () => {
      // 清理事件监听器
      unsubscribeStreamData();
    };
  }, [requestId, terminalInstance]);

  const getLog = useCallback(async () => {
    if (type === 'history') {
      await getHistoryLog({
        fileName: requestId.replace(/gz-.*$/, 'gz'),
        requestId,
        filters: filtersRef.current,
      });
    }
    if (type === 'realtime') {
      await getRealtimeLog({
        fileName: requestId.replace(/-.*$/, ''),
        requestId,
        filters: filtersRef.current,
      });
    }
  }, [getHistoryLog, getRealtimeLog, requestId, type]);

  // 获取实时日志
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const terminalContainer = terminalContainerRef.current;
      openTerminal(terminalContainer);

      if (requestId) {
        await getLog();
      }
      setLoading(false);
    };

    init();

    return () => {
      clearStream(requestId);
    };
  }, [getLog, clearStream, openTerminal, requestId]);

  // // Handlers for LogFilter
  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    filtersRef.current = newFilters;
  };

  const handleApply = () => {
    onFilterChange(filtersRef.current);
  };

  const handleClear = () => {
    onFilterChange(defaultFilters);
  };

  const handleClose = () => {
    setVisible(false);
  };
  return (
    <div className="relative w-full h-full flex flex-col bg-black text-white">
      {/* 搜索组件常驻顶部区域 */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 flex items-center">
        {/* 折叠按钮 - 在最左侧 */}
        <div className="flex-shrink-0 px-2">
          {onSidebarToggle && (
            <button
              type="button"
              onClick={onSidebarToggle}
              className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-300"
              title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
              aria-label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            >
              <svg
                className={`w-5 h-5 transition-all duration-300 ${
                  sidebarCollapsed ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}
        </div>

        {/* 搜索组件 - 中间扩展 */}
        <div className="flex-1">
          <SearchComponent
            searchText={searchText}
            caseSensitive={caseSensitive}
            onSearchTextChange={handleSearchTextChange}
            onCaseSensitiveChange={handleCaseSensitiveChange}
            onSearchNext={searchNext}
            onSearchPrevious={searchPrevious}
            searchResults={searchResults}
          />
        </div>

        {/* 过滤按钮 - 在最右侧 */}
        <div className="flex-shrink-0 px-3">
          <button
            type="button"
            onClick={() => {
              setVisible(!visible);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full transition-colors"
            title="过滤日志"
            aria-label="过滤日志"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z"
              />
            </svg>
          </button>
        </div>
      </div>

      <LogFilter
        visible={visible}
        filters={filters}
        onFilterChange={handleFilterChange}
        onApply={handleApply}
        onClear={handleClear}
        onClose={handleClose}
      />
      <div className="flex-1 pl-2">
        <div ref={terminalContainerRef} className="w-full h-full text-white" />
      </div>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black bg-opacity-50">
          <span className="text-white">Loading...</span>
        </div>
      )}
    </div>
  );
};

export default Index;
