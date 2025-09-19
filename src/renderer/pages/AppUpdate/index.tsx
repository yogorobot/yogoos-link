import React, { useEffect, useState, useRef } from 'react';
import { useFile, useApp } from '../../hooks';
import { useToast } from '../../components/NotificationProvider';

interface AppUpdateOptions {
  filePath: string;
  targetDirectory?: string;
  selectedApp?: string;
}

interface UploadProgress {
  transferred?: number;
  total?: number;
  percentage: number;
  stage: 'uploading' | 'extracting' | 'restarting' | 'completed' | 'error';
  message: string;
}

const Index = () => {
  const container = useRef<HTMLDivElement>(null);
  const { showOpenDialog } = useFile();
  const { updateApp, onUpdateProgress } = useApp();
  const { showSuccess, showError } = useToast();

  // 状态管理
  const [updateOptions, setUpdateOptions] = useState<AppUpdateOptions>({
    filePath: '',
    targetDirectory: '/srv/yogoos/apps/',
    selectedApp: 'takeaway',
  });

  const [progress, setProgress] = useState<UploadProgress>({
    percentage: 0,
    stage: 'uploading',
    message: 'Ready to upload...',
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // 处理文件选择
  const handleFileSelect = async () => {
    if (isUpdating) return;

    try {
      const result = await showOpenDialog({
        title: '选择ZIP更新文件',
        filters: [
          { name: 'ZIP文件', extensions: ['zip'] },
          { name: '所有文件', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.success && result.filePath) {
        // 获取文件统计信息来验证文件
        const fs = window.require ? window.require('fs') : null;
        if (fs) {
          try {
            const stats = fs.statSync(result.filePath);
            const fileName = result.filePath.split('/').pop() || 'unknown.zip';

            // 验证文件类型和大小
            if (!fileName.toLowerCase().endsWith('.zip')) {
              showError('请选择ZIP文件');
              return;
            }

            if (stats.size > 500 * 1024 * 1024) {
              showError('文件大小超过500MB限制');
              return;
            }

            if (stats.size === 0) {
              showError('文件为空，请选择有效的ZIP文件');
              return;
            }

            const fileObj = {
              name: fileName,
              size: stats.size,
              type: 'application/zip',
              path: result.filePath,
            } as File & { path: string };

            setUploadFile(fileObj);
            setUpdateOptions((prev) => ({
              ...prev,
              filePath: result.filePath,
            }));
          } catch {
            showError('无法读取文件信息，请重新选择');
          }
        } else {
          // 后备方案：创建基本文件对象
          const fileName = result.filePath.split('/').pop() || 'unknown.zip';

          if (!fileName.toLowerCase().endsWith('.zip')) {
            showError('请选择ZIP文件');
            return;
          }

          const fileObj = {
            name: fileName,
            size: 0, // 未知大小
            type: 'application/zip',
            path: result.filePath,
          } as File & { path: string };

          setUploadFile(fileObj);
          setUpdateOptions((prev) => ({ ...prev, filePath: result.filePath }));
        }
      }
    } catch {
      showError('选择文件失败，请重试');
    }
  };

  // 开始更新
  const handleStartUpdate = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    if (!uploadFile || isUpdating) return;

    // 验证文件路径
    if (!updateOptions.filePath) {
      showError('请先选择ZIP文件');
      return;
    }

    // 验证文件存在性
    if (uploadFile.path) {
      const fs = window.require ? window.require('fs') : null;
      if (fs && !fs.existsSync(uploadFile.path)) {
        showError('选择的文件不存在，请重新选择');
        return;
      }
    }

    // 验证目标目录
    if (!updateOptions.targetDirectory?.trim()) {
      showError('请输入目标目录');
      return;
    }

    try {
      setIsUpdating(true);

      const finalOptions = {
        ...updateOptions,
        filePath: updateOptions.filePath,
      };

      const result = await updateApp(finalOptions);

      if (!result.success) {
        throw new Error(result.error || '更新操作失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      showError(`更新失败: ${errorMsg}`);
      setIsUpdating(false);
    }
  };

  // 监听更新进度
  useEffect(() => {
    const unsubscribe = onUpdateProgress((progressData: UploadProgress) => {
      setProgress(progressData);

      if (progressData.stage === 'completed') {
        setIsUpdating(false);
        showSuccess(progressData.message || '应用更新完成！');
      } else if (progressData.stage === 'error') {
        setIsUpdating(false);
        showError(progressData.message || '更新过程中发生错误');
      }
    });

    return unsubscribe;
  }, [onUpdateProgress, showSuccess, showError]);

  return (
    <div className="flex flex-col w-full h-full max-w-none from-gray-900 via-indigo-900/20 shadow-2xl relative overflow-hidden">
      <style>{`
        @keyframes sweep {
          0% { transform: translateX(-100%) skew(12deg); opacity: 0; }
          50% { transform: translateX(0%) skew(12deg); opacity: 1; }
          100% { transform: translateX(100%) skew(12deg); opacity: 0; }
        }
      `}</style>
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

      {/* 主要内容区域 */}
      <div
        className="relative z-10 flex-1 flex flex-col p-6 overflow-y-auto"
        ref={container}
      >
        {/* 页面标题区域 */}
        <div className="relative text-center mb-8">
          {/* 上方光晕效果 */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4 w-32 h-1 bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent rounded-full blur-sm" />

          {/* 主标题与特效 */}
          <div className="relative">
            {/* 背景光晕 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-cyan-500/30 bg-clip-text blur-3xl">
                应用升级工具
              </div>
            </div>

            {/* 主标题 */}
            <h1 className="relative text-2xl font-black mb-2 italic transform -skew-x-6 drop-shadow-2xl overflow-hidden">
              <span className="relative bg-gradient-to-r from-indigo-300 via-purple-200 to-cyan-300 bg-clip-text text-transparent">
                🚀 应用升级工具
                {/* 灯光扫射效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 animate-[sweep_3s_ease-in-out_infinite] transform skew-x-6 w-full">
                  <div className="w-full h-full bg-gradient-to-r from-transparent via-white/60 to-transparent blur-sm" />
                </div>
                {/* 额外发光层 */}
                <div className="absolute inset-0 text-2xl font-black bg-gradient-to-r from-white/20 via-white/40 to-white/20 bg-clip-text text-transparent animate-pulse">
                  🚀 应用升级工具
                </div>
              </span>
            </h1>

            {/* 下方光晕 */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent rounded-full blur-sm" />
          </div>

          <p className="text-white/70 text-sm font-normal mt-2 tracking-wide">
            选择ZIP文件并自动部署到远程服务器
          </p>
        </div>

        <form className="space-y-6 flex-1 flex flex-col min-h-0">
          {/* 主配置区域 */}
          <div className="space-y-6 p-6 bg-white/5 border border-white/20 rounded-2xl backdrop-blur-xl shadow-2xl hover:bg-white/[0.07] transition-all duration-300 relative overflow-hidden flex-1 min-h-0">
            {/* 背景装饰元素 */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl" />

            {/* 内部光晕 */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.04] pointer-events-none" />

            <div className="relative space-y-6 h-full overflow-y-auto">
              {/* 文件选择区域 */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-white/90 flex items-center gap-2">
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
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  更新文件 (ZIP格式)
                </label>

                {/* 文件选择区域 */}
                <div className="relative">
                  <div
                    className="h-32 bg-white/10 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center transition-all duration-300 hover:border-indigo-400/50 hover:bg-white/15 group cursor-pointer backdrop-blur-sm shadow-inner"
                    onClick={handleFileSelect}
                    style={
                      isUpdating ? { pointerEvents: 'none', opacity: 0.5 } : {}
                    }
                  >
                    {uploadFile ? (
                      // 已选择文件状态
                      <div className="text-center px-4 py-3">
                        <div className="flex items-center justify-center gap-3">
                          <svg
                            className="h-8 w-8 text-green-400 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {uploadFile.name}
                            </p>
                            <p className="text-xs text-green-400">
                              ✓ 文件已就绪
                            </p>
                          </div>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs bg-white/10 text-white/80 border border-white/20 rounded-lg hover:bg-white/15 transition-all flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadFile(null);
                              setUpdateOptions((prev) => ({
                                ...prev,
                                filePath: '',
                              }));
                            }}
                          >
                            更换
                          </button>
                        </div>
                      </div>
                    ) : (
                      // 未选择文件状态
                      <div className="text-center px-4 py-3">
                        <div className="flex items-center justify-center gap-4">
                          <svg
                            className="h-12 w-12 text-white/40 group-hover:text-indigo-400 transition-colors flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          <div className="flex-1">
                            <h3 className="text-base font-medium text-white/90 mb-1">
                              选择ZIP文件
                            </h3>
                            <p className="text-sm text-white/60">
                              点击选择要上传的更新文件
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={handleFileSelect}
                            className="bg-gradient-to-r from-indigo-500/20 to-indigo-600/20 hover:from-indigo-500/30 hover:to-indigo-600/30 border border-indigo-500/30 rounded-lg px-4 py-2 text-white text-sm font-medium transition-all disabled:opacity-50 flex-shrink-0"
                          >
                            选择文件
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-white/60">
                      💡 支持最大500MB的ZIP文件上传
                    </p>
                  </div>
                </div>

                {/* 应用配置 */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-white/90 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"
                      />
                    </svg>
                    目标目录
                  </label>
                  <input
                    type="text"
                    name="targetDirectory"
                    value={updateOptions.targetDirectory}
                    onChange={(e) =>
                      setUpdateOptions((prev) => ({
                        ...prev,
                        targetDirectory: e.target.value,
                      }))
                    }
                    disabled={isUpdating}
                    placeholder="/srv/yogoos/apps/"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400/60 focus:bg-white/15 transition-all duration-300 backdrop-blur-sm hover:bg-white/12 focus:shadow-lg focus:shadow-indigo-500/20 shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 开始更新按钮 */}
          <div className="flex-shrink-0 pt-4">
            <button
              type="button"
              onClick={handleStartUpdate}
              disabled={isUpdating || !uploadFile}
              className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed border-none rounded-xl px-6 py-3 text-white text-sm font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 disabled:transform-none relative overflow-hidden"
            >
              {isUpdating ? (
                <>
                  {/* 进度条背景 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-700" />
                  {/* 进度条 */}
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-400 to-indigo-500 transition-all duration-300 ease-out"
                    style={{ width: `${progress.percentage}%` }}
                  />
                  {/* 按钮内容 */}
                  <div className="relative z-10 flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>
                      {progress.message} (
                      {progress.percentage % 1 === 0
                        ? `${progress.percentage}%`
                        : `${progress.percentage.toFixed(1)}%`}
                      )
                    </span>
                  </div>
                </>
              ) : (
                <div className="relative z-10 flex items-center gap-2">
                  <span>🚀</span>
                  <span>开始应用升级</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Index;
