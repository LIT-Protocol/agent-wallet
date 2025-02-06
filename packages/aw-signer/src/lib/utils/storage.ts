/// <reference lib="dom" />
import { LocalStorage as NodeLocalStorage } from 'node-localstorage';

interface StorageInterface {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

function isNode(): boolean {
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null;
}

export class LocalStorage implements StorageInterface {
  private storage: StorageInterface;

  constructor(storageFilePath: string) {
    if (isNode()) {
      this.storage = new NodeLocalStorage(storageFilePath);
    } else {
      // Use browser's localStorage
      this.storage = typeof window !== 'undefined' ? window.localStorage : {} as StorageInterface;
    }
  }

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  removeItem(key: string): void {
    this.storage.removeItem(key);
  }

  clear(): void {
    this.storage.clear();
  }
}
