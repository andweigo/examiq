import {useContext} from 'react';
import {ServiceContainer} from '@app/ServiceContainer';
import {ServicesContext} from '@context/ServicesContext';

export function useServices(): ServiceContainer {
  const container = useContext(ServicesContext);
  if (!container) {
    throw new Error('useServices must be called within a ServicesProvider.');
  }
  return container;
}
