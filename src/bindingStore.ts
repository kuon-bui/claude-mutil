import { normalizeFolderKey } from './paths';
import type { KeyValueStore } from './store';

const STORAGE_KEY = 'claudeAccounts.bindings';

type Bindings = Record<string, string>;

/** Cặp thư mục → id hồ sơ, lưu trong `globalState` (không ghi vào `.vscode/settings.json`). */
export class BindingStore {
  constructor(private readonly store: KeyValueStore, private readonly platform: NodeJS.Platform) {}

  get(folder: string): string | undefined {
    return this.read()[normalizeFolderKey(folder, this.platform)];
  }

  async set(folder: string, profileId: string): Promise<void> {
    await this.store.update(STORAGE_KEY, { ...this.read(), [normalizeFolderKey(folder, this.platform)]: profileId });
  }

  async removeProfile(profileId: string): Promise<void> {
    const kept = Object.fromEntries(Object.entries(this.read()).filter(([, id]) => id !== profileId));
    await this.store.update(STORAGE_KEY, kept);
  }

  private read(): Bindings {
    const raw = this.store.get<Bindings>(STORAGE_KEY);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  }
}
