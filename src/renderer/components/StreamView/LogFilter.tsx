import React, { useState } from 'react';
// Filter options for log display

export interface FilterOptions {
  searchTerm: string;
  caseSensitive: boolean;
  customPattern?: string;
  excludeTerms?: string[];
}

interface LogFilterProps {
  visible: boolean;
  filters: FilterOptions;
  onFilterChange: (filters: Partial<FilterOptions>) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}

function LogFilter({
  visible,
  filters,
  onFilterChange,
  onApply,
  onClear,
  onClose,
}: LogFilterProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!visible) return null;

  const handleSearchTermChange = (value: string) => {
    onFilterChange({
      ...filters,
      searchTerm: value || '',
    });
  };

  const handleCaseSensitiveChange = (checked: boolean) => {
    onFilterChange({
      ...filters,
      caseSensitive: checked,
    });
  };

  const handleExcludeTermsChange = (value: string) => {
    onFilterChange({
      ...filters,
      excludeTerms: value ? value.split(',').map((t) => t.trim()) : [],
    });
  };

  return (
    <div className="yogo-panel absolute right-3 top-14 z-20 max-h-[min(34rem,calc(100%-4rem))] w-96 overflow-y-auto rounded-3xl max-sm:left-3 max-sm:right-3 max-sm:w-auto">
      <div className="sticky top-0 border-b border-slate-800/80 bg-slate-950/95 p-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">日志过滤器</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-800/80 hover:text-slate-100"
            aria-label="关闭过滤器"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Search Term */}
        <div>
          <label
            htmlFor="filter-input"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            搜索关键词
          </label>
          <input
            id="filter-input"
            type="text"
            value={filters.searchTerm || ''}
            onChange={(e) => handleSearchTermChange(e.target.value)}
            placeholder="例如: ERROR 或 [Face]"
            className="yogo-input w-full rounded-xl px-3 py-2.5 text-sm transition"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                onApply();
              }
            }}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            留空显示所有内容，使用固定字符串匹配
          </p>
        </div>

        {/* Case Sensitivity */}
        <div className="flex items-center space-x-3">
          <label className="flex cursor-pointer items-center text-sm text-slate-300">
            <input
              type="checkbox"
              checked={filters.caseSensitive}
              onChange={(e) => handleCaseSensitiveChange(e.target.checked)}
              className="mr-2 h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-500 focus:ring-2 focus:ring-blue-500/50"
            />
            区分大小写
          </label>
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm font-medium text-blue-300 transition-colors hover:text-blue-200"
        >
          <svg
            className={`mr-1 h-4 w-4 transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          高级选项
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 border-t border-slate-800/80 pt-4">
            {/* Exclude Terms */}
            <div>
              <label
                htmlFor="exclude-input"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                排除关键词 (逗号分隔)
              </label>
              <input
                id="exclude-input"
                type="text"
                value={filters.excludeTerms?.join(', ') || ''}
                onChange={(e) => handleExcludeTermsChange(e.target.value)}
                placeholder="例如: DEBUG, TRACE, heartbeat"
                className="yogo-input w-full rounded-xl px-3 py-2.5 text-sm transition"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                排除包含这些关键词的日志行
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 border-t border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={onApply}
            className="yogo-button-primary flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition"
          >
            应用过滤
          </button>
          <button
            type="button"
            onClick={onClear}
            className="yogo-button-secondary flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogFilter;
