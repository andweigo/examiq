import {useSyncExternalStore} from 'react';
import {useServices} from './useServices';

export function useScanning() {
  const {scanningService} = useServices();
  const state = useSyncExternalStore(
    scanningService.subscribe,
    scanningService.getState,
  );
  return {
    ...state,
    flaggedTileNumbers: scanningService.getFlaggedTileNumbers(),
    service: scanningService,
  };
}
