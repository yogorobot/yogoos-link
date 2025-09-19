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
    <div className="absolute top-16 right-2 z-10 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-96 max-h-[600px] overflow-y-auto">
      <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <svg
              className="w-5 h-5 mr-2 text-indigo-500"
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
            日志过滤器
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="关闭过滤器"
          >
            <svg
              className="w-5 h-5"
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

      <div className="p-4 space-y-4">
        {/* Search Term */}
        <div>
          <label
            htmlFor="filter-input"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            搜索关键词
          </label>
          <input
            id="filter-input"
            type="text"
            value={filters.searchTerm || ''}
            onChange={(e) => handleSearchTermChange(e.target.value)}
            placeholder="例如: ERROR 或 [Face]"
            className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                onApply();
              }
            }}
          />
          <p className="text-xs text-gray-500 mt-1">
            留空显示所有内容，使用固定字符串匹配
          </p>
        </div>

        {/* Case Sensitivity */}
        <div className="flex items-center space-x-3">
          <label className="flex items-center text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.caseSensitive}
              onChange={(e) => handleCaseSensitiveChange(e.target.checked)}
              className="mr-2 w-4 h-4 text-indigo-600 bg-gray-800 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
            />
            区分大小写
          </label>
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <svg
            className={`w-4 h-4 mr-1 transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
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
          <div className="space-y-4 pt-2 border-t border-gray-700">
            {/* Exclude Terms */}
            <div>
              <label
                htmlFor="exclude-input"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                排除关键词 (逗号分隔)
              </label>
              <input
                id="exclude-input"
                type="text"
                value={filters.excludeTerms?.join(', ') || ''}
                onChange={(e) => handleExcludeTermsChange(e.target.value)}
                placeholder="例如: DEBUG, TRACE, heartbeat"
                className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                排除包含这些关键词的日志行
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onApply}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white py-2 px-4 rounded-md text-sm font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg
              className="inline-block w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            应用过滤
          </button>
          <button
            type="button"
            onClick={onClear}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-md text-sm font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg
              className="inline-block w-4 h-4 mr-1"
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
            重置
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogFilter;
