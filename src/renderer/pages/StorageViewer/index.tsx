import { useState, useEffect, useRef, useCallback } from 'react';
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
    if (value > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="w-full bg-gray-700 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full ${getBarColor()}`}
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
    <div className="w-full h-screen bg-gray-900/90 text-white font-sans flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-cyan-300">设备存储信息</h1>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-sm text-gray-400">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span>每5秒自动刷新</span>
            </div>
            {lastUpdated && (
              <div className="text-xs text-gray-500 mt-1">
                最近刷新于: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {isLoading && (
            <div className="text-center text-gray-400 py-10">正在加载...</div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-500/50 text-red-300 p-4 rounded-lg">
              {error}
            </div>
          )}

          {!isLoading && !error && (
            <div className="overflow-x-auto rounded-lg border border-gray-700/50 bg-gray-800/40">
              <table className="min-w-full divide-y divide-gray-700/50">
                <thead className="bg-gray-800/60">
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
                        className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-gray-900/50 divide-y divide-gray-700/50">
                  {storageEntries.map((entry) => (
                    <tr
                      key={`${entry.filesystem}-${entry.mountedOn}`}
                      className="hover:bg-gray-700/40 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-cyan-300">
                        {entry.filesystem}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {entry.size}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {entry.used}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {entry.available}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex items-center gap-3">
                          <div className="w-24">
                            <ProgressBar value={entry.capacityPercent} />
                          </div>
                          <span>{entry.capacity}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400">
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

      {/* Fixed Footer */}
      <div className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-t border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-center">
          <span className="text-gray-400 text-sm">实时显示设备存储信息</span>
        </div>
      </div>
    </div>
  );
};

export default StorageViewer;
