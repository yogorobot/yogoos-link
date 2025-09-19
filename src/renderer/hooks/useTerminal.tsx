import { useCallback, useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css'; // 添加这行 CSS 导入
import SearchComponent from '../components/SearchComponent';

// 默认搜索装饰选项
const defaultDecorations = {
  matchBackground: '#515c6a',
  matchBorder: 'transparent',
  matchOverviewRuler: '#ffa500',
  activeMatchBackground: '#ffeb3b',
  activeMatchBorder: 'transparent',
  activeMatchColorOverviewRuler: '#ff0000',
};

const useTerminal = () => {
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const webglAddonInstance = useRef<WebglAddon | null>(null);
  const searchAddonInstance = useRef<SearchAddon | null>(null);

  // 搜索状态
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState({ current: 0, total: 0 });
  const [caseSensitive, setCaseSensitive] = useState(false);

  useEffect(() => {
    // 创建新的 addons
    fitAddonInstance.current = new FitAddon();
    webglAddonInstance.current = new WebglAddon();
    searchAddonInstance.current = new SearchAddon({
      highlightLimit: Infinity,
    });

    terminalInstance.current = new Terminal({
      scrollback: 99999999999999,
      fontSize: 12,
      lineHeight: 1.2,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      allowProposedApi: true,
      overviewRulerWidth: 10,
      theme: {
        // background: '#ccc',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
      },
    });

    // 加载 canvas addon (Canvas 渲染器应该在 fit addon 之前加载)
    terminalInstance.current.loadAddon(webglAddonInstance.current);

    // 加载 fit addon
    terminalInstance.current.loadAddon(fitAddonInstance.current);

    // 加载搜索 addon，启用概览标尺
    terminalInstance.current.loadAddon(searchAddonInstance.current);

    // 设置搜索结果事件监听
    const searchResultsDisposable =
      searchAddonInstance.current.onDidChangeResults((results) => {
        console.log('搜索结果更新:', results);
        setSearchResults({
          current: results.resultIndex >= 0 ? results.resultIndex + 1 : 0, // 从1开始计数，-1表示超出阈值
          total: results.resultCount,
        });
      });

    return () => {
      terminalInstance.current?.dispose();
      fitAddonInstance.current?.dispose();
      // webglAddonInstance.current?.dispose();
      searchAddonInstance.current?.dispose();
      searchResultsDisposable?.dispose();
    };
  }, []);

  const openTerminal = useCallback((terminalContainer: HTMLDivElement) => {
    if (terminalContainer && terminalInstance.current) {
      terminalInstance.current.open(terminalContainer);
      fitAddonInstance.current?.fit();
    }
  }, []);

  useEffect(() => {
    const resize = () => {
      if (fitAddonInstance.current) {
        fitAddonInstance.current?.fit();
      }
    };

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 搜索方法
  const searchNext = useCallback(
    (text?: string) => {
      const query = text || searchText;
      if (searchAddonInstance.current && query) {
        const result = searchAddonInstance.current.findNext(query, {
          caseSensitive,
          wholeWord: false,
          regex: false,
          incremental: false,
          decorations: defaultDecorations,
        });
        return result;
      }
      return false;
    },
    [searchText, caseSensitive],
  );

  const searchPrevious = useCallback(
    (text?: string) => {
      const query = text || searchText;
      if (searchAddonInstance.current && query) {
        const result = searchAddonInstance.current.findPrevious(query, {
          caseSensitive,
          wholeWord: false,
          regex: false,
          incremental: false,
          decorations: defaultDecorations,
        });
        return result;
      }
      return false;
    },
    [searchText, caseSensitive],
  );

  const clearSearch = useCallback(() => {
    if (searchAddonInstance.current) {
      terminalInstance.current.clearSelection();
      searchAddonInstance.current.clearDecorations();
      searchAddonInstance.current.clearActiveDecoration?.();
    }
    setSearchText('');
    setSearchResults({ current: 0, total: 0 });
  }, []);

  // 搜索文本改变处理
  const handleSearchTextChange = useCallback(
    (value: string) => {
      if (value) {
        setSearchText(value);
      } else {
        clearSearch();
      }
    },
    [clearSearch],
  );

  // 大小写敏感性改变处理
  const handleCaseSensitiveChange = useCallback(
    (value: boolean) => {
      setCaseSensitive(value);

      if (searchText && searchAddonInstance.current) {
        terminalInstance.current.clearSelection();
        searchAddonInstance.current.clearDecorations();
        searchAddonInstance.current.clearActiveDecoration?.();
        searchAddonInstance.current.findNext('');
        // 立即用新的大小写设置搜索
        searchAddonInstance.current.findNext(searchText, {
          caseSensitive: value,
          wholeWord: false,
          regex: false,
          incremental: false,
          decorations: defaultDecorations,
        });
        // 搜索结果统计会通过onDidChangeResults事件自动更新
      }
    },
    [searchText],
  );

  return {
    terminalInstance,
    fitAddonInstance,
    webglAddonInstance,
    searchAddonInstance,
    openTerminal,
    // 搜索相关
    SearchComponent,
    searchNext,
    searchPrevious,
    searchText,
    handleSearchTextChange,
    searchResults,
    caseSensitive,
    handleCaseSensitiveChange,
  };
};

export default useTerminal;
