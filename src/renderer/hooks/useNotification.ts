import { useCallback } from 'react';

export interface NotificationOptions {
  title?: string;
  body: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  silent?: boolean;
}

export const useNotification = () => {
  const showNotification = useCallback(async (options: NotificationOptions) => {
    try {
      const { title, body, type = 'info', silent = false } = options;

      // 根据类型设置默认标题
      let defaultTitle = 'SSH Inspector';
      switch (type) {
        case 'success':
          defaultTitle = '✅ 操作成功';
          break;
        case 'error':
          defaultTitle = '❌ 操作失败';
          break;
        case 'warning':
          defaultTitle = '⚠️ 注意';
          break;
        case 'info':
          defaultTitle = 'ℹ️ 提示';
          break;
      }

      const result = await window.electron.ipcRenderer.invoke('notification:show', {
        title: title || defaultTitle,
        body,
        type,
        silent,
      });

      if (!result.success) {
        console.error('显示系统通知失败:', result.error);
        // 如果系统通知失败，可以考虑降级到浏览器通知或控制台输出
        console.warn(`${defaultTitle}: ${body}`);
      }

      return result;
    } catch (error) {
      console.error('系统通知调用失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }, []);

  const showSuccess = useCallback((message: string, title?: string) => {
    return showNotification({
      title,
      body: message,
      type: 'success'
    });
  }, [showNotification]);

  const showError = useCallback((message: string, title?: string) => {
    return showNotification({
      title,
      body: message,
      type: 'error'
    });
  }, [showNotification]);

  const showWarning = useCallback((message: string, title?: string) => {
    return showNotification({
      title,
      body: message,
      type: 'warning'
    });
  }, [showNotification]);

  const showInfo = useCallback((message: string, title?: string) => {
    return showNotification({
      title,
      body: message,
      type: 'info'
    });
  }, [showNotification]);

  const checkPermission = useCallback(async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('notification:check-permission');
      return result;
    } catch (error) {
      console.error('检查通知权限失败:', error);
      return { success: false, supported: false };
    }
  }, []);

  return {
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    checkPermission,
  };
};
