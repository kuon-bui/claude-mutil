import { randomBytes } from 'node:crypto';
import { defaultConfigDir, profileDir } from './paths';
import type { KeyValueStore } from './store';

export const PROFILE_COLORS = ['charts.blue', 'charts.green', 'charts.orange', 'charts.purple', 'charts.red', 'charts.yellow'] as const;

export const DEFAULT_PROFILE_ID = 'default';
const DEFAULT_PROFILE_NAME = 'Default';
const STORAGE_KEY = 'claudeAccounts.profiles';

export interface Profile {
  id: string; name: string; color: string; configDir: string; isDefault: boolean;
  /**
   * Chỉ hồ sơ Mặc định: giá trị `CLAUDE_CONFIG_DIR` người dùng đã đặt sẵn ngoài VS Code (nếu có).
   * Áp dụng Mặc định thì đặt lại đúng giá trị này thay vì xoá biến.
   */
  envDir?: string;
}

export class DuplicateNameError extends Error {
  constructor(name: string) { super(`A profile named "${name}" already exists.`); this.name = 'DuplicateNameError'; }
}
export class EmptyNameError extends Error {
  constructor() { super('Profile name cannot be empty.'); this.name = 'EmptyNameError'; }
}

interface StoredProfile { id: string; name: string; color: string }
interface StoredState { defaultName?: string; profiles: StoredProfile[] }

const nameKey = (name: string) => name.trim().normalize('NFC').toLocaleLowerCase();

/** Danh sách hồ sơ, lưu trong `globalState`. Hồ sơ "Mặc định" (`~/.claude`) luôn có và luôn đứng đầu. */
export class ProfileStore {
  /** `defaultDir`: `CLAUDE_CONFIG_DIR` có sẵn trong môi trường lúc extension kích hoạt (đặt ngoài VS Code), nếu có. */
  constructor(private readonly store: KeyValueStore, private readonly home: string, private readonly defaultDir?: string) {}

  list(): Profile[] {
    const state = this.read();
    return [
      { id: DEFAULT_PROFILE_ID, name: state.defaultName ?? DEFAULT_PROFILE_NAME, color: PROFILE_COLORS[0],
        configDir: this.defaultDir ?? defaultConfigDir(this.home), isDefault: true,
        ...(this.defaultDir !== undefined && { envDir: this.defaultDir }) },
      ...state.profiles.map((p) => ({ ...p, configDir: profileDir(this.home, p.id), isDefault: false })),
    ];
  }

  get(id: string): Profile | undefined {
    return this.list().find((p) => p.id === id);
  }

  async add(name: string): Promise<Profile> {
    const clean = this.validateName(name);
    const state = this.read();
    const existing = this.list();
    let id: string;
    do { id = randomBytes(4).toString('hex'); } while (existing.some((p) => p.id === id));
    const stored = { id, name: clean, color: PROFILE_COLORS[existing.length % PROFILE_COLORS.length] };
    await this.write({ ...state, profiles: [...state.profiles, stored] });
    return { ...stored, configDir: profileDir(this.home, id), isDefault: false };
  }

  async rename(id: string, name: string): Promise<void> {
    if (!this.get(id)) throw new Error(`Profile ${id} does not exist.`);
    const clean = this.validateName(name, id);
    const state = this.read();
    if (id === DEFAULT_PROFILE_ID) {
      await this.write({ ...state, defaultName: clean });
    } else {
      await this.write({ ...state, profiles: state.profiles.map((p) => (p.id === id ? { ...p, name: clean } : p)) });
    }
  }

  async remove(id: string): Promise<void> {
    if (id === DEFAULT_PROFILE_ID) throw new Error('Cannot delete the Default profile.');
    const state = this.read();
    await this.write({ ...state, profiles: state.profiles.filter((p) => p.id !== id) });
  }

  /** Bỏ khoảng trắng đầu cuối; ném lỗi nếu rỗng hoặc trùng tên hồ sơ khác (không phân biệt hoa thường). */
  validateName(name: string, selfId?: string): string {
    const clean = name.trim();
    if (!clean) throw new EmptyNameError();
    if (this.list().some((p) => p.id !== selfId && nameKey(p.name) === nameKey(clean))) throw new DuplicateNameError(clean);
    return clean;
  }

  private read(): StoredState {
    const raw = this.store.get<StoredState>(STORAGE_KEY);
    return { defaultName: raw?.defaultName, profiles: Array.isArray(raw?.profiles) ? raw.profiles : [] };
  }

  private write(state: StoredState): Thenable<void> {
    return this.store.update(STORAGE_KEY, state);
  }
}
