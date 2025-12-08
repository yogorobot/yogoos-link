import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

const Root = () => {
  return (
    <div className="flex flex-col w-full h-full">
      <App />
    </div>
  );
};

root.render(<Root />);
