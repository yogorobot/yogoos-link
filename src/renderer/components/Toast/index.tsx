import React, { useEffect, useState } from 'react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 4000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  useEffect(() => {
    // 入场动画
    const showTimer = setTimeout(() => {
      setIsAnimating(true);
    }, 10);

    // 自动关闭
    const hideTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [duration]);

  if (!isVisible) return null;

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: '✅',
          bgColor: 'bg-emerald-500/15',
          borderColor: 'border-emerald-500/30',
          textColor: 'text-emerald-300',
          iconColor: 'text-emerald-400',
        };
      case 'error':
        return {
          icon: '⚠',
          bgColor: 'bg-red-500/15',
          borderColor: 'border-red-500/30',
          textColor: 'text-red-300',
          iconColor: 'text-red-400',
        };
      case 'warning':
        return {
          icon: '⚠️',
          bgColor: 'bg-yellow-500/15',
          borderColor: 'border-yellow-500/30',
          textColor: 'text-yellow-300',
          iconColor: 'text-yellow-400',
        };
      default:
        return {
          icon: 'ℹ️',
          bgColor: 'bg-blue-500/15',
          borderColor: 'border-blue-500/30',
          textColor: 'text-blue-300',
          iconColor: 'text-blue-400',
        };
    }
  };

  const config = getToastConfig();

  return (
    <div
      className={`transition-all duration-300 transform max-w-[calc(100vw-2rem)] ${
        isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div
        className={`${config.bgColor} ${config.borderColor} border rounded-xl px-4 py-3 ${config.textColor} text-sm backdrop-blur-sm shadow-lg w-80 max-w-full`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 ${config.iconColor} flex-shrink-0`}>
            {config.icon}
          </div>
          <span className="flex-1">{message}</span>
          <button
            type="button"
            onClick={handleClose}
            className="text-white/60 hover:text-white/90 transition-colors ml-2"
            aria-label="关闭"
          >
            <svg
              className="w-4 h-4"
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
      </div>
    </div>
  );
};

export default Toast;
