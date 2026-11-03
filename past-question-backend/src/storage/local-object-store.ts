import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ObjectNotFoundError, type ObjectStore } from './object-store.js';

/**
 * Local-disk driver. Development and test only; production policy rejects it.
 */
export class LocalObjectStore implements ObjectStore {
  readonly kind = 'local' as const;
  private readonly root: string;

  constructor(localDir: string) {
    this.root = resolve(localDir);
  }

  private pathFor(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/\.\./g, '_');
    const full = resolve(join(this.root, safe));
    if (!full.startsWith(this.root + sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.pathFor(key));
    } catch (e: any) {
      if (e?.code === 'ENOENT') throw new ObjectNotFoundError(key);
      throw e;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await mkdir(this.root, { recursive: true });
      await access(this.root);
      return true;
    } catch {
      return false;
    }
  }
}
