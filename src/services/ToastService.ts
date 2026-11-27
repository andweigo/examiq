import {ObservableStore} from '@core/base/ObservableStore';

export interface ToastState {
  readonly message: string | null;
}

/**
 * Lightweight OOP notification toast service for offline feedback messages.
 */
export class ToastService extends ObservableStore<ToastState> {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super({message: null});
  }

  public show(message: string, durationMs = 2400): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.setState({message});
    this.timer = setTimeout(() => {
      this.setState({message: null});
      this.timer = null;
    }, durationMs);
  }

  public dismiss(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.setState({message: null});
  }
}
