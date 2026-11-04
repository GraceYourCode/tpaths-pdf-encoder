/** Storage driver contract. Drivers handle opaque bytes; encryption lives above them. */
export interface ObjectStore {
  readonly kind: 'local' | 's3';
  put(key: string, data: Buffer): Promise<void>;
  /** Removes an object. Missing objects are not an error. */
  delete(key: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Cheap reachability check used by the readiness probe. */
  ping(): Promise<boolean>;
}

export class ObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Object not found: ${key}`);
    this.name = 'ObjectNotFoundError';
  }
}
