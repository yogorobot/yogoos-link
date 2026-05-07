import { useEffect, useState } from 'react';
import { useWindow } from '../hooks';

interface AuthInfo {
  host: string;
  port: string;
  username: string;
  useJumpHost?: boolean;
  jumpHost?: string;
}

interface WindowInfo {
  title?: string;
  authInfo?: AuthInfo | null;
}

interface WindowTitlebarProps {
  fallbackTitle?: string;
}

const formatWindowTitle = (info: WindowInfo | null, fallbackTitle?: string) => {
  const authInfo = info?.authInfo;
  if (!authInfo?.host) return fallbackTitle || info?.title || 'YOLINK';

  const hostTitle = `${authInfo.username}@${authInfo.host}:${authInfo.port}`;
  if (authInfo.useJumpHost && authInfo.jumpHost) {
    return `${authInfo.jumpHost} -> ${hostTitle}`;
  }
  return hostTitle;
};

export default function WindowTitlebar({ fallbackTitle }: WindowTitlebarProps) {
  const { getCurrentWindowInfo } = useWindow();
  const [title, setTitle] = useState(fallbackTitle || 'YOLINK');

  useEffect(() => {
    let isMounted = true;

    const loadTitle = async () => {
      const result = await getCurrentWindowInfo();
      if (!isMounted) return;

      const windowInfo = result?.success ? result.data : result;
      setTitle(formatWindowTitle(windowInfo, fallbackTitle));
    };

    loadTitle();

    return () => {
      isMounted = false;
    };
  }, [fallbackTitle, getCurrentWindowInfo]);

  return (
    <div className="yogo-titlebar-safe-area [-webkit-app-region:drag]">
      <div className="yogo-titlebar-content">{title}</div>
    </div>
  );
}
