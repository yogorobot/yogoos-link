import React, { useRef } from 'react';

interface SearchComponentProps {
  className?: string;
  searchText: string;
  caseSensitive: boolean;
  searchResults?: { current: number; total: number };
  onSearchTextChange: (value: string) => void;
  onCaseSensitiveChange: (value: boolean) => void;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
}

const SearchComponent: React.FC<SearchComponentProps> = ({
  className = '',
  searchText,
  caseSensitive,
  searchResults,
  onSearchTextChange,
  onCaseSensitiveChange,
  onSearchNext,
  onSearchPrevious,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onSearchPrevious();
      } else {
        onSearchNext();
      }
    }
  };

  return (
    <div className={`w-full bg-gray-800 ${className}`}>
      <div className="flex items-center gap-1 p-3 py-2">
        <button
          type="button"
          onClick={() => onCaseSensitiveChange(!caseSensitive)}
          className={`p-2 text-sm rounded focus:outline-none transition-colors ${
            caseSensitive
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
          }`}
          title="区分大小写"
        >
          <span className="font-mono text-xs">Aa</span>
        </button>

        <div className="relative flex-1 max-w-md">
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索..."
            className="w-full px-3 py-2 pr-20 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:border-indigo-500"
          />
          {/* 搜索结果统计 - 内嵌在输入框右侧 */}
          {searchResults && searchResults.total > 0 && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 font-mono bg-gray-700 px-1">
              {searchResults.current}/{searchResults.total}
            </div>
          )}
        </div>

        {/* 导航按钮组 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSearchPrevious()}
            className="p-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            title="上一个 (Shift+Enter)"
            disabled={!searchResults || searchResults.total === 0}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onSearchNext()}
            className="p-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            title="下一个 (Enter)"
            disabled={!searchResults || searchResults.total === 0}
          >
            ↓
          </button>
        </div>

        {/* 放大镜按钮 */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onSearchNext()}
            className="p-2 text-sm bg-gray-700 text-gray-400 rounded hover:bg-gray-600 hover:text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            title="搜索 (Enter)"
            aria-label="搜索"
            disabled={!searchText}
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchComponent;
