import { createRoot } from 'react-dom/client';
import App from './App';
import TitleBar from './components/TitleBar';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

const Root = () => {
  return (
    <div className="flex flex-col w-full h-full">
      {/* <TitleBar /> */}
      <App />
    </div>
  );
};

root.render(<Root />);

// // calling IPC exposed from preload script
// window.electron?.ipcRenderer.once('ipc-example', (arg) => {
//   // eslint-disable-next-line no-console
//   console.log(arg);
// });
// window.electron?.ipcRenderer.sendMessage('ipc-example', ['ping']);
