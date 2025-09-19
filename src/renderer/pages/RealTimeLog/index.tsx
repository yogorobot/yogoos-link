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
  const [selectedFile, setSelectedFile] = useState(null);
  const { getRealtimeLogFile } = useLog();
  const [requestId, setRequestId] = useState<string>(null);
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
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
      setSelectedFile(logs[0]);
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
    <div className="relative w-full h-full flex flex-col min-h-0">
      {requestId && (
        <StreamView
          key={requestId}
          type="realtime"
          filters={filters}
          defaultFilters={defaultFilters}
          onFilterChange={onFilterChange}
          requestId={requestId}
        />
      )}
    </div>
  );
};

export default Index;
