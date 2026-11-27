import {useSyncExternalStore} from 'react';
import {useServices} from './useServices';

export function useProfileSettings() {
  const {profileSettingsService} = useServices();
  const state = useSyncExternalStore(
    profileSettingsService.subscribe,
    profileSettingsService.getState,
  );
  return {
    ...state,
    unreadAlertCount: profileSettingsService.getUnreadAlertCount(),
    service: profileSettingsService,
  };
}
