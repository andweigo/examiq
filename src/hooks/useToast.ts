import {useSyncExternalStore} from 'react';
import {useServices} from './useServices';

export function useToast() {
  const {toastService} = useServices();
  const state = useSyncExternalStore(
    toastService.subscribe,
    toastService.getState,
  );
  return {
    message: state.message,
    showToast: (msg: string) => toastService.show(msg),
    dismissToast: () => toastService.dismiss(),
  };
}
