import { IElectron } from '../main/preload';

declare global {
  interface Window {
    electron: IElectron;
  }
}
