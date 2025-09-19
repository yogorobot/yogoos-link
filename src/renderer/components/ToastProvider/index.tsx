import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
} from 'react';
import Toast, { ToastProps } from '../Toast';

interface ToastMessage extends Omit<ToastProps, 'onClose'> {
  id: string;
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastProps['type'],
    duration?: number,
  ) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = React.useCallback(
    (message: string, type: ToastProps['type'] = 'info', duration = 4000) => {
      const id = Date.now().toString();
      const newToast: ToastMessage = {
        id,
        message,
        type,
        duration,
      };

      setToasts((prev) => [...prev, newToast]);
    },
    [],
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = React.useCallback(
    (message: string, duration = 4000) => {
      showToast(message, 'success', duration);
    },
    [showToast],
  );

  const showError = React.useCallback(
    (message: string, duration = 6000) => {
      showToast(message, 'error', duration);
    },
    [showToast],
  );

  const showWarning = React.useCallback(
    (message: string, duration = 5000) => {
      showToast(message, 'warning', duration);
    },
    [showToast],
  );

  const showInfo = React.useCallback(
    (message: string, duration = 4000) => {
      showToast(message, 'info', duration);
    },
    [showToast],
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
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast容器 */}
      <div className="fixed top-14 right-4 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
