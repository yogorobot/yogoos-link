import React, { useEffect, useState, useRef } from 'react';
import { useFile, useApp } from '../../hooks';
import { useToast } from '../../components/NotificationProvider';
import WindowTitlebar from '../../components/WindowTitlebar';

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
      const { data, success } = await showOpenDialog({
        title: '选择ZIP更新文件',
        filters: [
          { name: 'ZIP文件', extensions: ['zip'] },
          { name: '所有文件', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      console.log('data', data);

      if (success && data.filePath) {
        // 获取文件统计信息来验证文件
        const fs = window.require ? window.require('fs') : null;
        if (fs) {
          try {
            const stats = fs.statSync(data.filePath);
            const fileName = data.filePath.split('/').pop() || 'unknown.zip';

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
              path: data.filePath,
            } as File & { path: string };

            setUploadFile(fileObj);
            setUpdateOptions((prev) => ({
              ...prev,
              filePath: data.filePath,
            }));
          } catch {
            showError('无法读取文件信息，请重新选择');
          }
        } else {
          // 后备方案：创建基本文件对象
          const fileName = data.filePath.split('/').pop() || 'unknown.zip';

          if (!fileName.toLowerCase().endsWith('.zip')) {
            showError('请选择ZIP文件');
            return;
          }

          const fileObj = {
            name: fileName,
            size: 0, // 未知大小
            type: 'application/zip',
            path: data.filePath,
          } as File & { path: string };

          setUploadFile(fileObj);
          setUpdateOptions((prev) => ({ ...prev, filePath: data.filePath }));
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

      await updateApp(finalOptions);
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
    <div className="yogo-page relative flex h-full w-full max-w-none flex-col overflow-hidden">
      <WindowTitlebar fallbackTitle="UI 应用升级" />

      {/* 主要内容区域 */}
      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto p-4 [-webkit-app-region:no-drag]"
        ref={container}
      >
        <form className="flex min-h-0 flex-1 flex-col space-y-4">
          {/* 主配置区域 */}
          <div className="yogo-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl p-5 max-sm:p-4">
            <div className="h-full space-y-6 overflow-y-auto">
              {/* 文件选择区域 */}
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  更新文件 (ZIP格式)
                </label>

                {/* 文件选择区域 */}
                <div className="relative">
                  <div
                    className="group flex h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 transition hover:border-blue-400/60 hover:bg-slate-900/70"
                    onClick={handleFileSelect}
                    style={
                      isUpdating ? { pointerEvents: 'none', opacity: 0.5 } : {}
                    }
                  >
                    {uploadFile ? (
                      // 已选择文件状态
                      <div className="text-center px-4 py-3">
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-slate-100">
                              {uploadFile.name}
                            </p>
                            <p className="text-xs text-emerald-400">
                              ✓ 文件已就绪
                            </p>
                          </div>
                          <button
                            type="button"
                            className="yogo-button-secondary flex-shrink-0 rounded-lg px-3 py-1.5 text-xs transition"
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
                          <div className="flex-1">
                            <h3 className="mb-1 text-base font-medium text-slate-100">
                              选择ZIP文件
                            </h3>
                            <p className="text-sm text-slate-500">
                              点击选择要上传的更新文件
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={handleFileSelect}
                            className="yogo-button-secondary flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                          >
                            选择文件
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-slate-500">
                      支持最大500MB的ZIP文件上传
                    </p>
                  </div>
                </div>

                {/* 应用配置 */}
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
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
                    className="yogo-input w-full rounded-xl px-4 py-3 text-sm"
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
              className="yogo-button-primary relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isUpdating ? (
                <>
                  {/* 进度条背景 */}
                  <div className="absolute inset-0 bg-blue-600" />
                  {/* 进度条 */}
                  <div
                    className="absolute left-0 top-0 h-full bg-blue-400/70 transition-all duration-300 ease-out"
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
                  <span>开始UI应用升级</span>
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
