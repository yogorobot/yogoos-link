import React, { useRef, useState, useEffect } from 'react';
import { useSSH, useFile } from '../../hooks';
import { useToast } from '../../components/NotificationProvider';
// import icon from '../../../../assets/yolink_icon.svg';

interface SSHCredentials {
  host: string;
  port: string;
  username: string;
  password: string;
  // 跳板机相关配置
  useJumpHost?: boolean;
  jumpHost?: string;
  jumpPort?: string;
  jumpUsername?: string;
  jumpAuthType?: 'password' | 'key';
  jumpPassword?: string;
  jumpKeyFilePath?: string;
}

interface ServerRecord {
  id: string;
  host: string;
  port: string;
  username: string;
  useJumpHost?: boolean;
  jumpHost?: string;
  jumpPort?: string;
  jumpUsername?: string;
  jumpAuthType?: 'password' | 'key';
  jumpKeyFilePath?: string;
  timestamp: number;
  displayName: string;
}

const isBlank = (value?: string) => !value?.trim();

const isValidPort = (value?: string) => {
  if (isBlank(value)) {
    return false;
  }

  if (!/^\d+$/.test(value || '')) {
    return false;
  }

  const port = Number.parseInt(value || '', 10);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
};

const validateJumpHostSettings = (
  values: Partial<SSHCredentials>,
): string | null => {
  if (!values.useJumpHost) {
    return null;
  }

  if (isBlank(values.jumpHost)) {
    return '启用跳板机后，请填写跳板机地址';
  }

  if (!isValidPort(values.jumpPort || '22')) {
    return '请输入有效的跳板机端口';
  }

  if (isBlank(values.jumpUsername)) {
    return '启用跳板机后，请填写跳板机用户名';
  }

  if ((values.jumpAuthType ?? 'key') === 'password') {
    if (isBlank(values.jumpPassword)) {
      return '请选择密码认证后填写跳板机密码';
    }

    return null;
  }

  if (isBlank(values.jumpKeyFilePath)) {
    return '请选择跳板机私钥文件';
  }

  return null;
};

const normalizeCredentials = (values: SSHCredentials): SSHCredentials => ({
  ...values,
  host: values.host.trim(),
  port: values.port.trim(),
  username: values.username.trim(),
  jumpHost: values.jumpHost?.trim() || '',
  jumpPort: values.jumpPort?.trim() || '',
  jumpUsername: values.jumpUsername?.trim() || '',
  jumpPassword: values.jumpPassword || '',
  jumpKeyFilePath: values.jumpKeyFilePath?.trim() || '',
});

const Index = () => {
  const container = useRef<HTMLDivElement>(null);
  const [credentials, setCredentials] = useState<SSHCredentials>({
    host: '',
    port: '22',
    username: 'yogo',
    password: '',
    // 跳板机配置
    useJumpHost: false,
    jumpHost: '',
    jumpPort: '1111',
    jumpUsername: '',
    jumpAuthType: 'key',
    jumpPassword: '',
    jumpKeyFilePath: '~/.ssh/id_rsa',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showJumpHostSettings, setShowJumpHostSettings] = useState(false);
  const [tempJumpHostSettings, setTempJumpHostSettings] = useState<
    Partial<SSHCredentials>
  >({});
  const [serverHistory, setServerHistory] = useState<ServerRecord[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  // 移除动态窗口调整功能
  const { authenticate } = useSSH();
  const { showOpenDialog } = useFile();
  const { showError, showSuccess } = useToast();

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHistoryDropdown) {
        const target = event.target as Element;
        if (!target.closest('.history-dropdown-container')) {
          setShowHistoryDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHistoryDropdown]);

  // 加载设备历史记录
  useEffect(() => {
    const loadServerHistory = () => {
      try {
        const stored = localStorage.getItem('ssh_server_history');
        if (stored) {
          const history = JSON.parse(stored) as ServerRecord[];
          setServerHistory(history);
        }
      } catch (error) {
        console.error('加载设备历史记录失败:', error);
      }
    };
    loadServerHistory();
  }, []);

  // 保存设备记录
  const saveServerRecord = (creds: SSHCredentials) => {
    try {
      const newRecord: ServerRecord = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        host: creds.host,
        port: creds.port,
        username: creds.username,
        useJumpHost: creds.useJumpHost,
        jumpHost: creds.jumpHost,
        jumpPort: creds.jumpPort,
        jumpUsername: creds.jumpUsername,
        jumpAuthType: creds.jumpAuthType,
        jumpKeyFilePath: creds.jumpKeyFilePath,
        timestamp: Date.now(),
        displayName: `${creds.username}@${creds.host}:${creds.port}`,
      };

      setServerHistory((prev) => {
        // 移除重复记录（相同host+port+username）
        const filtered = prev.filter(
          (record) =>
            !(
              record.host === newRecord.host &&
              record.port === newRecord.port &&
              record.username === newRecord.username
            ),
        );

        // 添加新记录到开头，限制最多30条
        const updated = [newRecord, ...filtered].slice(0, 30);

        // 保存到localStorage
        localStorage.setItem('ssh_server_history', JSON.stringify(updated));

        return updated;
      });
    } catch (error) {
      console.error('保存设备记录失败:', error);
    }
  };

  // 应用历史记录
  const applyServerRecord = (record: ServerRecord) => {
    setCredentials((prev) => ({
      ...prev,
      host: record.host,
      port: record.port,
      username: record.username,
      password: '', // 清空密码，需要用户重新输入
      useJumpHost: record.useJumpHost ?? false,
      jumpHost: record.jumpHost ?? '',
      jumpPort: record.jumpPort ?? prev.jumpPort,
      jumpUsername: record.jumpUsername ?? '',
      jumpAuthType: record.jumpAuthType ?? prev.jumpAuthType,
      jumpPassword: '',
      jumpKeyFilePath: record.jumpKeyFilePath ?? prev.jumpKeyFilePath,
    }));
    // showSuccess(`已应用设备记录: ${record.displayName}`);
  };

  // 删除历史记录
  const removeServerRecord = (recordId: string) => {
    setServerHistory((prev) => {
      const updated = prev.filter((record) => record.id !== recordId);
      localStorage.setItem('ssh_server_history', JSON.stringify(updated));
      return updated;
    });
    showSuccess('历史记录已删除');
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setCredentials((prev) => ({ ...prev, [name]: checked }));
    } else {
      setCredentials((prev) => ({ ...prev, [name]: value }));
    }
  };

  // 跳板机设置的临时状态处理
  const handleTempInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setTempJumpHostSettings((prev) => ({ ...prev, [name]: checked }));
    } else {
      setTempJumpHostSettings((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleKeyFileSelect = async () => {
    try {
      // 使用Electron原生文件对话框，支持访问隐藏文件和目录
      const { data, success } = await showOpenDialog({
        title: '选择SSH私钥文件',
        defaultPath: '~/.ssh',
        properties: ['openFile', 'showHiddenFiles'],
      });

      if (success && data.filePath) {
        // 在设置模态框中时，更新临时状态
        if (showJumpHostSettings) {
          setTempJumpHostSettings((prev) => ({
            ...prev,
            jumpKeyFilePath: data.filePath,
          }));
          showSuccess('SSH私钥文件选择成功');
        } else {
          setCredentials((prev) => ({
            ...prev,
            jumpKeyFilePath: data.filePath,
          }));
          showSuccess('SSH私钥文件选择成功');
        }
        // 不需要清除错误信息，因为没有error状态了
      }
    } catch (err) {
      console.error('选择文件失败:', err);
      showError('选择文件失败，请重试');
    }
  };

  // 确认保存跳板机设置
  const handleConfirmJumpHostSettings = () => {
    const nextCredentials = {
      ...credentials,
      ...tempJumpHostSettings,
    };
    const validationError = validateJumpHostSettings(nextCredentials);
    if (validationError) {
      showError(validationError);
      return;
    }

    // 将临时状态应用到正式配置
    setCredentials((prev) => ({
      ...prev,
      useJumpHost: tempJumpHostSettings.useJumpHost ?? prev.useJumpHost,
      jumpHost: tempJumpHostSettings.jumpHost ?? prev.jumpHost,
      jumpPort: tempJumpHostSettings.jumpPort ?? prev.jumpPort,
      jumpUsername: tempJumpHostSettings.jumpUsername ?? prev.jumpUsername,
      jumpAuthType: tempJumpHostSettings.jumpAuthType ?? prev.jumpAuthType,
      jumpPassword: tempJumpHostSettings.jumpPassword ?? prev.jumpPassword,
      jumpKeyFilePath:
        tempJumpHostSettings.jumpKeyFilePath ?? prev.jumpKeyFilePath,
    }));
    setShowJumpHostSettings(false);
    setTempJumpHostSettings({});
  };

  // 取消跳板机设置
  const handleCancelJumpHostSettings = () => {
    setShowJumpHostSettings(false);
    setTempJumpHostSettings({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextCredentials = normalizeCredentials(credentials);
    const validationError = validateJumpHostSettings(nextCredentials);
    if (validationError) {
      showError(validationError);
      return;
    }
    if (!isValidPort(nextCredentials.port)) {
      showError('请输入有效的设备端口');
      return;
    }

    setIsLoading(true);

    try {
      // 调用主进程进行SSH认证
      const result = await authenticate(nextCredentials);

      if (!result.success) {
        showError(result.error || '连接失败，请检查您的SSH连接信息');
      } else {
        showSuccess('连接成功!');
        // 保存成功连接的设备记录
        saveServerRecord(nextCredentials);
      }
    } catch (authError) {
      showError(`连接过程中发生错误: ${authError.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 移除ResizeObserver，保持固定窗口大小

  return (
    // <div className="h-full overflow-y-auto">
    <div
      className="flex flex-col w-full h-full max-w-none from-gray-900 via-indigo-900/20 shadow-2xl relative overflow-hidden"
      ref={container}
    >
      {/* <style>{`
        @keyframes sweep {
          0% { transform: translateX(-100%) skew(12deg); opacity: 0; }
          50% { transform: translateX(0%) skew(12deg); opacity: 1; }
          100% { transform: translateX(100%) skew(12deg); opacity: 0; }
        }
      `}</style> */}
      {/* 动态背景效果 */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-full filter blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full filter blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-pink-500/20 to-indigo-500/20 rounded-full filter blur-2xl" />
      </div>
      {/* 网格背景 */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
      </div>

      <header
        className="flex-shrink-0"
        style={
          {
            WebkitAppRegion: 'drag',
            userSelect: 'none',
            backdropFilter: 'blur(20px)',
          } as React.CSSProperties
        }
      >
        <div className="relative text-center my-6 mt-10">
          <div className="group relative inline-flex items-center justify-center p-1">
            {/* Unified Glow Effect for the whole component */}
            <div
              className="absolute -inset-2 rounded-full motion-safe:animate-[rotate-glow_10s_linear_infinite]"
              // style={{
              //   backgroundImage: `conic-gradient(from 180deg at 50% 50%, rgba(168, 85, 247, 0) 0deg, #a855f7 50deg, rgba(168, 85, 247, 0.2) 150deg, #5eead4 200deg, rgba(94, 234, 212, 0) 100%)`,
              //   filter: 'blur(15px)',
              //   opacity: 0.6,
              // }}
            />

            {/* Shared Background Plate */}
            <div className="relative flex items-center h-10 bg-gray-900/80 backdrop-blur-sm shadow-2xl px-4">
              {/* Icon */}
              {/* <div className="relative w-16 h-16 flex items-center justify-center">
                <img
                  src={icon}
                  alt="App icon"
                  className="w-16 h-16 transition-transform duration-300 group-hover:scale-105"
                />
              </div> */}

              {/* Text with clear separation */}
              <h1 className="relative text-4xl font-black ml-4 italic transform -skew-x-12 drop-shadow-2xl overflow-hidden">
                <span className="relative bg-gradient-to-r from-indigo-300 via-purple-200 to-cyan-300 bg-clip-text text-transparent">
                  YOLINK
                </span>
              </h1>
            </div>
          </div>
        </div>
      </header>
      {/* 主要内容区域 */}
      {/* <div className="relative z-10 flex-1 flex flex-col p-6"> */}
      <form
        id="login-form"
        onSubmit={handleSubmit}
        className="space-y-5 flex-1 flex flex-col px-6 overflow-hidden"
      >
        {/* 设备配置区域 */}
        <div className="space-y-5 p-6 bg-white/5 border border-white/20 rounded-2xl backdrop-blur-xl flex-1 shadow-2xl hover:bg-white/[0.07] transition-all duration-300 relative overflow-y-auto">
          {/* 内部光晕 */}
          {/* <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.04] pointer-events-none" /> */}
          <div className="relative space-y-5 history-dropdown-container">
            <div className="space-y-2">
              <label
                htmlFor="host"
                className="block text-sm font-medium text-white/90 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
                设备
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  id="host"
                  name="host"
                  value={credentials.host}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  placeholder="请输入机器人编号"
                  required
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400/60 focus:bg-white/15 transition-all duration-300 backdrop-blur-sm hover:bg-white/12 focus:shadow-lg focus:shadow-indigo-500/20 shadow-sm"
                />
                {/* 历史记录图标 */}
                <button
                  type="button"
                  onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                  disabled={isLoading || serverHistory.length === 0}
                  className="flex-shrink-0 bg-white/10 p-2 ml-2 text-white/60 hover:text-white/90 hover:bg-white/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title={
                    serverHistory.length > 0 ? '查看历史记录' : '暂无历史记录'
                  }
                  aria-label="历史记录"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>

                {/* 历史记录下拉菜单 */}
                {showHistoryDropdown && serverHistory.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 max-h-70 overflow-y-auto scrollbar-thin">
                    <div className="p-2">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-1">
                        <div className="text-xs text-white/60">
                          历史连接记录 ({serverHistory.length})
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowHistoryDropdown(false)}
                          className="p-1 text-white/60 hover:text-white/90 hover:bg-white/10 rounded-lg transition-all"
                          title="关闭"
                          aria-label="关闭历史记录"
                        >
                          <svg
                            className="w-3 h-3"
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
                      {serverHistory.map((record) => (
                        <div
                          key={record.id}
                          className="group flex items-center justify-between p-3 hover:bg-white/10 rounded-lg cursor-pointer transition-all"
                          onClick={() => {
                            applyServerRecord(record);
                            setShowHistoryDropdown(false);
                          }}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-sm text-white/90 font-medium truncate">
                              {record.displayName}
                            </div>
                            <div className="text-xs text-white/60 mt-1">
                              {new Date(record.timestamp).toLocaleDateString(
                                'zh-CN',
                                {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                },
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeServerRecord(record.id);
                            }}
                            className="flex-shrink-0 w-6 h-6 bg-red-500/20 hover:bg-red-500/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                            title="删除记录"
                            aria-label="删除记录"
                          >
                            <svg
                              className="w-3 h-3 text-red-400"
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
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="port"
                className="block text-sm font-medium text-white/90 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 7v10m0 0l3-3m-3 3l-3-3"
                  />
                </svg>
                端口
              </label>
              <input
                type="number"
                id="port"
                name="port"
                value={credentials.port}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="请输入端口号"
                min="1"
                max="65535"
                required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400/60 focus:bg-white/15 transition-all duration-300 backdrop-blur-sm hover:bg-white/12 focus:shadow-lg focus:shadow-indigo-500/20 shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-sm font-medium text-white/90 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                用户名
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="请输入用户名"
                required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400/60 focus:bg-white/15 transition-all duration-300 backdrop-blur-sm hover:bg-white/12 focus:shadow-lg focus:shadow-indigo-500/20 shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-white/90 flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                密码
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="请输入密码"
                required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400/60 focus:bg-white/15 transition-all duration-300 backdrop-blur-sm hover:bg-white/12 focus:shadow-lg focus:shadow-indigo-500/20 shadow-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 pb-6 flex gap-2">
          {/* 设置图标按钮 */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              // 打开设置时，将当前配置复制到临时状态
              setTempJumpHostSettings({
                useJumpHost: credentials.useJumpHost,
                jumpHost: credentials.jumpHost,
                jumpPort: credentials.jumpPort,
                jumpUsername: credentials.jumpUsername,
                jumpAuthType: credentials.jumpAuthType,
                jumpPassword: credentials.jumpPassword,
                jumpKeyFilePath: credentials.jumpKeyFilePath,
              });
              setShowJumpHostSettings(true);
            }}
            className="relative border border-white/20 flex-shrink-0 from-slate-500 via-slate-500 to-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all duration-300 font-semibold flex items-center justify-center gap-1 shadow-lg hover:shadow-slate-500/30 transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none overflow-hidden group"
            title="设置跳板机"
            aria-label="设置跳板机"
          >
            {/* 按钮内部光效 */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <svg
              className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>

          {/* 登录按钮 */}
          <button
            type="submit"
            form="login-form"
            disabled={isLoading}
            className="relative flex-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-600 hover:via-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all duration-300 font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/30 transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none overflow-hidden group min-h-[44px]"
          >
            {/* 按钮内部光效 */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {isLoading && (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-sm">连接中...</span>
              </div>
            )}

            {!isLoading && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">🚀</span>
                <div className="flex flex-col items-center">
                  <div className="text-sm font-medium">
                    建立连接
                    {credentials.useJumpHost ? (
                      <span className="text-xs text-green-300 font-medium opacity-90 whitespace-nowrap">
                        (已启用跳板机)
                      </span>
                    ) : (
                      ''
                    )}
                  </div>
                </div>
              </div>
            )}
          </button>
        </div>
      </form>
      {/* </div> */}

      {/* 跳板机设置模态框 */}
      {showJumpHostSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-gray-800/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* 模态框头部 */}
            <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-white/10">
              <h2 className="text-md font-semibold text-white flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                跳板机设置
              </h2>
            </div>

            {/* 模态框内容 */}
            <div className="p-3 space-y-4">
              {/* 启用跳板机选项 */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer text-sm text-white/90 select-none bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg px-4 py-3 transition-all">
                  <input
                    type="checkbox"
                    name="useJumpHost"
                    checked={
                      tempJumpHostSettings.useJumpHost ??
                      credentials.useJumpHost
                    }
                    onChange={handleTempInputChange}
                    className="w-4 h-4 border-2 border-white/30 rounded bg-transparent cursor-pointer checked:bg-green-500 checked:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 transition-all"
                  />
                  <span className="font-medium">启用跳板机连接</span>
                </label>
                {!(
                  tempJumpHostSettings.useJumpHost ?? credentials.useJumpHost
                ) && (
                  <p className="text-xs text-white/60 px-4">
                    启用后可通过跳板机连接到内网设备
                  </p>
                )}
              </div>

              {/* 跳板机配置表单 */}
              {(tempJumpHostSettings.useJumpHost ??
                credentials.useJumpHost) && (
                <div className="space-y-3 p-3 bg-gradient-to-br from-white/5 to-white/2 border border-white/10 rounded-xl">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-white/90">
                      跳板机地址
                    </label>
                    <input
                      type="text"
                      name="jumpHost"
                      value={
                        tempJumpHostSettings.jumpHost ?? credentials.jumpHost
                      }
                      onChange={handleTempInputChange}
                      placeholder="请输入跳板机地址"
                      required={
                        tempJumpHostSettings.useJumpHost ??
                        credentials.useJumpHost
                      }
                      className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/60 focus:bg-white/12 transition-all backdrop-blur-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-white/90">
                        端口
                      </label>
                      <input
                        type="number"
                        name="jumpPort"
                        value={
                          tempJumpHostSettings.jumpPort ?? credentials.jumpPort
                        }
                        onChange={handleTempInputChange}
                        placeholder="请输入端口"
                        min="1"
                        max="65535"
                        className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/60 focus:bg-white/12 transition-all backdrop-blur-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-white/90">
                        用户名
                      </label>
                      <input
                        type="text"
                        name="jumpUsername"
                        value={
                          tempJumpHostSettings.jumpUsername ??
                          credentials.jumpUsername
                        }
                        onChange={handleTempInputChange}
                        placeholder="请输入用户名"
                        required={
                          tempJumpHostSettings.useJumpHost ??
                          credentials.useJumpHost
                        }
                        className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/60 focus:bg-white/12 transition-all backdrop-blur-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-white/90">
                      认证方式
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="jumpAuthType"
                          value="key"
                          checked={
                            (tempJumpHostSettings.jumpAuthType ??
                              credentials.jumpAuthType) !== 'password'
                          }
                          onChange={handleTempInputChange}
                          className="w-4 h-4 text-green-500 focus:ring-green-500 border-gray-300"
                        />
                        <span className="text-sm text-white/90">密钥</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="jumpAuthType"
                          value="password"
                          checked={
                            (tempJumpHostSettings.jumpAuthType ??
                              credentials.jumpAuthType) === 'password'
                          }
                          onChange={handleTempInputChange}
                          className="w-4 h-4 text-green-500 focus:ring-green-500 border-gray-300"
                        />
                        <span className="text-sm text-white/90">密码</span>
                      </label>
                    </div>
                  </div>

                  {(tempJumpHostSettings.jumpAuthType ??
                    credentials.jumpAuthType) === 'password' ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-white/90">
                        密码
                      </label>
                      <input
                        type="password"
                        name="jumpPassword"
                        value={
                          tempJumpHostSettings.jumpPassword ??
                          credentials.jumpPassword
                        }
                        onChange={handleTempInputChange}
                        placeholder="请输入跳板机密码"
                        className="w-full bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/60 focus:bg-white/12 transition-all backdrop-blur-sm"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-white/90">
                        SSH私钥文件
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          name="jumpKeyFilePath"
                          value={
                            tempJumpHostSettings.jumpKeyFilePath ??
                            (credentials.jumpKeyFilePath || '')
                          }
                          onChange={handleTempInputChange}
                          placeholder="请选择SSH私钥文件"
                          className="flex-1 bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/60 focus:bg-white/12 transition-all backdrop-blur-sm font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleKeyFileSelect}
                          className="bg-gradient-to-r hover:from-green-500/30 hover:to-green-600/30 border border-green-500/30 rounded-xl px-3 py-2 text-white text-xs font-medium transition-all flex-shrink-0"
                        >
                          选择
                        </button>
                      </div>
                      <p className="text-xs text-white/60">
                        💡 请选择私钥文件，不是 .pub 公钥文件
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 模态框底部按钮 */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancelJumpHostSettings}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-all text-sm font-medium border border-white/20 hover:shadow-md"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmJumpHostSettings}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-xl transition-all text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    // </div>
  );
};

export default Index;
