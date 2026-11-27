export type StoreListener = () => void;

/**
 * Abstract reactive OOP store using Observer pattern.
 * Compatible with React 18/19 useSyncExternalStore while keeping
 * business state cleanly encapsulated inside OOP services.
 */
export abstract class ObservableStore<TState> {
  private _state: TState;
  private readonly listeners = new Set<StoreListener>();

  protected constructor(initialState: TState) {
    this._state = initialState;
  }

  public getState = (): TState => {
    return this._state;
  };

  public subscribe = (listener: StoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected setState(updater: TState | ((prev: TState) => TState)): void {
    const nextState =
      typeof updater === 'function'
        ? (updater as (prev: TState) => TState)(this._state)
        : updater;
    this._state = nextState;
    this.listeners.forEach(listener => listener());
  }
}
