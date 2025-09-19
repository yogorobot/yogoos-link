import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useNotification } from '../../hooks/useNotification';

interface NotificationContextType {
  showToast: (
    message: string,
    type?: 'success' | 'error' | 'warning' | 'info',
    duration?: number,
  ) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const useToast = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useToast must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const {
    showSuccess: notifySuccess,
    showError: notifyError,
    showWarning: notifyWarning,
    showInfo: notifyInfo,
    showNotification,
  } = useNotification();

  const showToast = React.useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'warning' | 'info' = 'info',
    ) => {
      // 保留duration参数以维持兼容性，但系统通知不支持自定义持续时间
      showNotification({ body: message, type });
    },
    [showNotification],
  );

  const showSuccess = React.useCallback(
    (message: string) => {
      notifySuccess(message);
    },
    [notifySuccess],
  );

  const showError = React.useCallback(
    (message: string) => {
      notifyError(message);
    },
    [notifyError],
  );

  const showWarning = React.useCallback(
    (message: string) => {
      notifyWarning(message);
    },
    [notifyWarning],
  );

  const showInfo = React.useCallback(
    (message: string) => {
      notifyInfo(message);
    },
    [notifyInfo],
  );

  const contextValue = useMemo(
    () => ({
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
    }),
    [showToast, showSuccess, showError, showWarning, showInfo],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {/* 不再需要渲染Toast容器，系统通知由操作系统处理 */}
    </NotificationContext.Provider>
  );
};
