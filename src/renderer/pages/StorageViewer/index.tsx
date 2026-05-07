import { useState, useEffect, useRef, useCallback } from 'react';
import WindowTitlebar from '../../components/WindowTitlebar';
import { useSystem } from '../../hooks';

// --- TYPE DEFINITIONS ---
interface StorageEntry {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  capacity: string;
  mountedOn: string;
  capacityPercent: number;
}

interface ProgressBarProps {
  value: number;
}

// --- HELPER FUNCTIONS ---
const parseStorageInfo = (dfOutput: string): StorageEntry[] => {
  if (!dfOutput || typeof dfOutput !== 'string') return [];
  const lines = dfOutput.trim().split('\n');
  if (lines.length < 2) return [];
  const dataLines = lines.slice(1);
  return dataLines.map((line) => {
    const parts = line.trim().split(/\s+/);
    const [filesystem, size, used, available, capacity, ...mountedOnParts] =
      parts;
    const mountedOn = mountedOnParts.join(' ');
    const capacityPercent = parseInt(capacity, 10) || 0;
    return {
      filesystem,
      size,
      used,
      available,
      capacity,
      mountedOn,
      capacityPercent,
    };
  });
};

// --- STABLE, EXTRACTED COMPONENTS ---
const ProgressBar = ({ value }: ProgressBarProps) => {
  const getBarColor = () => {
    if (value > 90) return 'bg-red-500';
    if (value > 70) return 'bg-amber-400';
    return 'bg-blue-400';
  };

  return (
    <div className="h-2 w-full rounded-full bg-slate-800">
      <div
        className={`h-2 rounded-full transition-all ${getBarColor()}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

// --- MAIN COMPONENT ---
const StorageViewer = () => {
  const [storageEntries, setStorageEntries] = useState<StorageEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getStorageInfo } = useSystem();
  const isInitialLoad = useRef(true);

  const fetchStorageInfo = useCallback(async () => {
    if (isInitialLoad.current) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = await getStorageInfo();
      if (result.success && result.data) {
        const parsedData = parseStorageInfo(result.data);
        setStorageEntries(parsedData);
        setLastUpdated(new Date());
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        }
      } else {
        const errorMessage = `获取失败: ${result.error || '未知错误'}`;
        setError(errorMessage);
      }
    } catch (e) {
      const errorMessage = `发生异常: ${(e as Error).message || '未知错误'}`;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [getStorageInfo]);

  useEffect(() => {
    fetchStorageInfo(); // Initial fetch
    const intervalId = setInterval(fetchStorageInfo, 5000);
    return () => clearInterval(intervalId);
  }, [fetchStorageInfo]);

  return (
    <div className="yogo-page flex h-screen w-full flex-col overflow-hidden font-sans text-slate-100">
      <WindowTitlebar fallbackTitle="设备存储" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 [-webkit-app-region:no-drag]">
        <section className="yogo-panel flex items-center justify-between gap-4 rounded-3xl px-5 py-4 max-sm:flex-col max-sm:items-start max-sm:px-4">
          <div>
            <p className="text-sm font-medium text-slate-400">设备存储</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">
              {isLoading ? '-' : storageEntries.length}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500 max-sm:w-full max-sm:justify-between">
            <span>每5秒自动刷新</span>
            {lastUpdated && (
              <span className="text-slate-600">
                上次更新: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </section>

        <div className="min-h-0 flex-1">
          {isLoading && (
            <div className="yogo-panel rounded-3xl px-5 py-8 text-center text-sm text-slate-400">
              正在加载...
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {!isLoading && !error && (
            <div className="yogo-panel overflow-x-auto rounded-3xl p-2">
              <table className="min-w-full divide-y divide-slate-800/80">
                <thead>
                  <tr>
                    {[
                      '文件系统',
                      '总大小',
                      '已用',
                      '可用',
                      '使用率',
                      '挂载点',
                    ].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {storageEntries.map((entry) => (
                    <tr
                      key={`${entry.filesystem}-${entry.mountedOn}`}
                      className="transition-colors hover:bg-slate-800/45"
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-mono text-sm text-blue-200">
                        {entry.filesystem}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-300">
                        {entry.size}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-300">
                        {entry.used}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-300">
                        {entry.available}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-300">
                        <div className="flex items-center gap-3">
                          <div className="w-24">
                            <ProgressBar value={entry.capacityPercent} />
                          </div>
                          <span>{entry.capacity}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-mono text-sm text-slate-400">
                        {entry.mountedOn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorageViewer;
