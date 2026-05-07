import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import RemoteDebug from './pages/RemoteDebug';
import SshConnections from './pages/SshConnections';
import HistoryLog from './pages/HistoryLog';
import RealTimeLog from './pages/RealTimeLog';
import AppUpdate from './pages/AppUpdate';
import AppSwitch from './pages/AppSwitch';
import PackageManager from './pages/PackageManager';
import StorageViewer from './pages/StorageViewer';
import { NotificationProvider } from './components/NotificationProvider';
import './tailwind.css';

function AppContent() {
  return (
    <div className="w-full h-full bg-gray-900/85 overflow-hidden flex flex-col">
      {/* 为自定义标题栏预留空间 */}
      {/* <div className="h-10 flex-shrink-0">
        <TitleBar />
      </div> */}

      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<SshConnections />} />
          <Route path="/connections" element={<SshConnections />} />
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
