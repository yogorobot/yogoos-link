import { Notification } from 'electron';
import { info, error } from 'electron-log';
import { ErrorResponse, SuccessResponse } from '../util';

interface NotificationOptions {
  title: string;
  body: string;
  type?: 'info' | 'warning' | 'error';
  silent?: boolean;
}

class NotificationManager {
  show(options: NotificationOptions) {
    try {
      const { title, body, type = 'info', silent = false } = options;

      if (!Notification.isSupported()) {
        return new ErrorResponse('系统不支持通知功能');
      }

      const notification = new Notification({
        title: title || 'SSH Inspector',
        body,
        silent,
        icon: undefined,
      });

      notification.show();

      info('系统通知已显示:', { title, body, type });

      return new SuccessResponse(null);
    } catch (err) {
      error('显示系统通知失败:', err);
      return new ErrorResponse(
        err instanceof Error ? err.message : '未知错误',
      );
    }
  }

  checkPermission() {
    try {
      return new SuccessResponse({
        supported: Notification.isSupported(),
      });
    } catch (err) {
      return new ErrorResponse(
        err instanceof Error ? err.message : '未知错误',
      );
    }
  }
}

export default NotificationManager;