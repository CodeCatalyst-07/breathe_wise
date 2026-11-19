/**
 * Async semaphore to bound concurrent outgoing requests.
 */
export class Semaphore {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  public constructor(private readonly limit: number) {}

  public async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running++;
  }

  public release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}
