// storage.ts : 保存アダプタ。拡張では chrome.storage.local。将来のPWAは localStorage 等に差し替えるだけ。
// 画面/ロジックは必ずこの store 経由で保存し、chrome.storage を直接散在させない。
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
export const store: Store = {
  get<T>(key: string) {
    return new Promise<T | null>((resolve) => chrome.storage.local.get(key, (items) => resolve((items[key] as T | undefined) ?? null)));
  },
  set<T>(key: string, value: T) {
    return new Promise<void>((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve()));
  },
  remove(key: string) {
    return new Promise<void>((resolve) => chrome.storage.local.remove(key, () => resolve()));
  },
};
