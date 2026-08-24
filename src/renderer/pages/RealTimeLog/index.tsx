import { useEffect, useState } from 'react';
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
  const [selectedFile, setSelectedFile] = useState(null);
  const { getRealtimeLogFile } = useLog();
  const [requestId, setRequestId] = useState<string>(null);
  const [defaultFilters, setDefaultFilters] =
    useState<FilterOptions>(getDefaultFilters());
  const [filters, setFilters] = useState<FilterOptions>(getDefaultFilters());
  const [time, setTime] = useState<number>(Date.now());

  const onFilterChange = (filter: FilterOptions) => {
    setFilters(filter);
    setTime(Date.now());
  };

  useEffect(() => {
    const fetchLogs = async () => {
      // setIsLoading(true);
      const logs = await getRealtimeLogFile();
      // setIsLoading(false);
      const firstFile = logs?.[0];
      if (firstFile) {
        const initialFilters = getDefaultFilters(firstFile.name);
        setDefaultFilters(initialFilters);
        setFilters(initialFilters);
        setSelectedFile(firstFile);
      }
    };
    fetchLogs();
  }, [getRealtimeLogFile]);

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
    <div className="yogo-page relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <WindowTitlebar fallbackTitle="实时日志" />
      <div className="min-h-0 flex-1 overflow-hidden [-webkit-app-region:no-drag]">
        {requestId ? (
          <StreamView
            key={requestId}
            type="realtime"
            filters={filters}
            defaultFilters={defaultFilters}
            onFilterChange={onFilterChange}
            requestId={requestId}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            正在准备实时日志...
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
