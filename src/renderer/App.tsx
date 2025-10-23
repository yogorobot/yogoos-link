import React from 'react';
import {
  HashRouter as Router,
  Routes,
  Route,
  // useNavigate,
  // useLocation,
} from 'react-router-dom';
import RemoteDebug from './pages/RemoteDebug';
import Login from './pages/Login';
import Home from './pages/Home';
import HistoryLog from './pages/HistoryLog';
import RealTimeLog from './pages/RealTimeLog';
import AppUpdate from './pages/AppUpdate';
import AppSwitch from './pages/AppSwitch';
import PackageManager from './pages/PackageManager';
import StorageViewer from './pages/StorageViewer';
import { NotificationProvider } from './components/NotificationProvider';
// import TitleBar from './components/TitleBar';
import './App.scss';

function AppContent() {
  // const navigate = useNavigate();
  // const location = useLocation();

  // useEffect(() => {
  //   // 全局监听SSH错误事件
  //   const removeSSHErrorListener = window.electron.events?.onSSHError?.(
  //     (data: any) => {
  //       // eslint-disable-next-line no-console
  //       console.error('SSH连接错误:', data);

  //       // 如果当前不在登录页面，则跳转到登录页面
  //       if (location.pathname !== '/login') {
  //         // eslint-disable-next-line no-alert
  //         alert(`SSH连接异常: ${data.message || data.error}\n即将返回登录页面`);
  //         navigate('/login');
  //       }
  //     },
  //   );

  //   // 全局监听SSH连接错误事件
  //   const removeSSHConnErrorListener =
  //     window.electron.events?.onSSHConnectionError?.((data: any) => {
  //       // eslint-disable-next-line no-console
  //       console.error('SSH连接中断:', data);

  //       // 如果当前不在登录页面，则跳转到登录页面
  //       if (location.pathname !== '/login') {
  //         // eslint-disable-next-line no-alert
  //         alert(`SSH连接中断: ${data.error}\n即将返回登录页面`);
  //         navigate('/login');
  //       }
  //     });

  //   // 全局监听强制登出事件
  //   const removeForceLogoutListener = window.electron.events?.onForceLogout?.(
  //     (data: any) => {
  //       // eslint-disable-next-line no-console
  //       console.log('收到强制登出事件:', data);

  //       // 如果当前不在登录页面，则跳转到登录页面
  //       if (location.pathname !== '/login') {
  //         if (data.reason) {
  //           // eslint-disable-next-line no-alert
  //           alert(`${data.reason}\n即将返回登录页面`);
  //         }
  //         navigate('/login');
  //       }
  //     },
  //   );

  //   // 清理监听器
  //   return () => {
  //     if (removeSSHErrorListener) removeSSHErrorListener();
  //     if (removeSSHConnErrorListener) removeSSHConnErrorListener();
  //     if (removeForceLogoutListener) removeForceLogoutListener();
  //   };
  // }, [navigate, location.pathname]);

  return (
    <div className="w-full h-full bg-gray-900/85 overflow-hidden flex flex-col">
      {/* 为自定义标题栏预留空间 */}
      {/* <div className="h-10 flex-shrink-0">
        <TitleBar />
      </div> */}

      <div className="flex-1 overflow-hidden">
        <Routes>
          {/* <Route path="/" element={<Login />} /> */}
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<Home />} />
          <Route path="/app-update" element={<AppUpdate />} />
          <Route path="/app-switch" element={<AppSwitch />} />
          <Route path="/remote-debug" element={<RemoteDebug />} />
          <Route path="/log-history-viewer" element={<HistoryLog />} />
          <Route path="/log-real-time-viewer" element={<RealTimeLog />} />
          <Route path="/package-manager" element={<PackageManager />} />
          <Route path="/storage-viewer" element={<StorageViewer />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </Router>
  );
}
