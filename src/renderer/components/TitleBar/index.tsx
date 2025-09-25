import React, { useState, useEffect } from 'react';
import { useWindow } from '../../hooks/useWindow';

interface TitleBarProps {
  title?: string;
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ title, className = '' }) => {
  const { getCurrentWindowInfo } = useWindow();
  const [windowInfo, setWindowInfo] = useState<any>(null);

  useEffect(() => {
    const updateWindowInfo = async () => {
      const info = await getCurrentWindowInfo();
      if (info) {
        setWindowInfo(info);
      }
    };

    // updateWindowInfo();
    // const interval = setInterval(updateWindowInfo, 1000);
    // return () => clearInterval(interval);
  }, [getCurrentWindowInfo]);

  return (
    <div
      className={`fixed top-0 left-0 right-0 h-10 bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-md border-b border-white/10 flex items-center justify-center px-4 z-50 ${className}`}
      style={
        {
          WebkitAppRegion: 'drag',
          backdropFilter: 'blur(20px)',
        } as React.CSSProperties
      }
    >
      <div className="flex items-center space-x-3">
        {/* <div className="w-3 h-3 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/50 animate-pulse" /> */}
        <h1 className="text-white/90 text-sm font-medium tracking-wide italic bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent drop-shadow-lg">
          {title || (
            <>
              {windowInfo?.authInfo?.host}
              {windowInfo?.authInfo?.useJumpHost &&
                `(${windowInfo?.authInfo?.jumpHost})`}
            </>
          )}
        </h1>
      </div>
    </div>
  );
};

export default TitleBar;
