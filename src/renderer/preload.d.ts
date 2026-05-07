import type { WebviewTag } from 'electron';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import { IElectron } from '../main/preload';

declare global {
  interface Window {
    electron: IElectron;
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<WebviewTag>, WebviewTag> & {
        src?: string;
      };
    }
  }
}
