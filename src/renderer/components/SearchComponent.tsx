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
    <div className={`w-full bg-transparent ${className}`}>
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          onClick={() => onCaseSensitiveChange(!caseSensitive)}
          className={`rounded-lg border p-2 text-sm transition-colors focus:outline-none ${
            caseSensitive
              ? 'border-blue-400/40 bg-blue-500/20 text-blue-100 hover:bg-blue-500/28'
              : 'border-slate-800 bg-slate-950/35 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
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
            className="yogo-input w-full rounded-xl px-3 py-2 pr-20 text-sm"
          />
          {/* 搜索结果统计 - 内嵌在输入框右侧 */}
          {searchResults && searchResults.total > 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-950/80 px-1.5 font-mono text-xs text-slate-400">
              {searchResults.current}/{searchResults.total}
            </div>
          )}
        </div>

        {/* 导航按钮组 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSearchPrevious()}
            className="rounded-lg border border-slate-800 bg-slate-950/35 px-2.5 py-2 text-sm text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            title="上一个 (Shift+Enter)"
            disabled={!searchResults || searchResults.total === 0}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onSearchNext()}
            className="rounded-lg border border-slate-800 bg-slate-950/35 px-2.5 py-2 text-sm text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
            className="rounded-lg border border-slate-800 bg-slate-950/35 p-2 text-sm text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            title="搜索 (Enter)"
            aria-label="搜索"
            disabled={!searchText}
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
