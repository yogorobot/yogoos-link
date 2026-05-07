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
  onMobileSidebarToggle?: () => void;
}

const Index: FC<IProps> = ({
  requestId,
  type,
  filters: propsFilters,
  defaultFilters,
  onFilterChange,
  sidebarCollapsed,
  onSidebarToggle,
  onMobileSidebarToggle,
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
    <div className="relative flex h-full w-full flex-col bg-slate-950/40 text-slate-100">
      {/* 搜索组件常驻顶部区域 */}
      <div className="flex flex-shrink-0 items-center border-b border-slate-800/80 bg-slate-950/70">
        {/* 折叠按钮 - 在最左侧 */}
        {(onMobileSidebarToggle || onSidebarToggle) && (
          <div className="flex-shrink-0 pl-2">
            {onMobileSidebarToggle && (
              <button
                type="button"
                onClick={onMobileSidebarToggle}
                className="hidden rounded-lg border border-slate-800 bg-slate-950/35 p-2 text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-100 max-[860px]:inline-flex"
                title="打开日志文件列表"
                aria-label="打开日志文件列表"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            )}
            {onSidebarToggle && (
              <button
                type="button"
                onClick={onSidebarToggle}
                className="rounded-lg p-2 text-slate-400 transition-all duration-300 hover:bg-slate-800/80 hover:text-slate-100 max-[860px]:hidden"
                title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
                aria-label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
              >
                <svg
                  className={`h-5 w-5 transition-all duration-300 ${
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
        )}

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
            className="rounded-full border border-blue-400/30 bg-blue-500/15 p-2 text-blue-200 transition-colors hover:bg-blue-500/25 hover:text-blue-100"
            title="过滤日志"
            aria-label="过滤日志"
          >
            <svg
              className="h-4 w-4"
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
      <div className="min-h-0 flex-1 bg-slate-950/30 pl-2">
        <div
          ref={terminalContainerRef}
          className="h-full w-full text-slate-100"
        />
      </div>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm">
          <span className="text-sm text-slate-300">正在加载...</span>
        </div>
      )}
    </div>
  );
};

export default Index;
