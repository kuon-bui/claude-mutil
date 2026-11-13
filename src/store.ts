/** Kho khoá–giá trị tương thích `vscode.Memento` (ví dụ `ExtensionContext.globalState`). */
export interface KeyValueStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}
