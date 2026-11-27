import React, {createContext, PropsWithChildren, useMemo} from 'react';
import {ServiceContainer} from '@app/ServiceContainer';

export const ServicesContext = createContext<ServiceContainer | null>(null);

export interface ServicesProviderProps extends PropsWithChildren {
  container?: ServiceContainer;
}

export const ServicesProvider: React.FC<ServicesProviderProps> = ({
  container,
  children,
}) => {
  const resolvedContainer = useMemo(
    () => container ?? ServiceContainer.getInstance(),
    [container],
  );

  return (
    <ServicesContext.Provider value={resolvedContainer}>
      {children}
    </ServicesContext.Provider>
  );
};
