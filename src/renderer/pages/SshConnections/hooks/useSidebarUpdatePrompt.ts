import { useEffect, useState } from 'react';
import { useAutoUpdate } from '../../../hooks';
import type { AppUpdateState } from '../../../hooks/useAutoUpdate';

export default function useSidebarUpdatePrompt() {
  const [updateState, setUpdateState] = useState<AppUpdateState | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const { getUpdateState } = useAutoUpdate();

  useEffect(() => {
    getUpdateState()
      .then((result) => {
        if (result?.success) {
          setUpdateState(result.data);
        }
        return null;
      })
      .catch(() => null);

    const unsubscribe = window.electron.ipcRenderer.on(
      'update:event',
      (payload) => {
        const nextState = payload as AppUpdateState;
        setUpdateState(nextState);
        if (nextState.status !== 'available') {
          setShowUpdatePrompt(false);
        }
      },
    );

    return unsubscribe;
  }, [getUpdateState]);

  return {
    updateState,
    showUpdatePrompt,
    setShowUpdatePrompt,
  };
}
