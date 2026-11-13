import path from 'node:path';

/** Thư mục cấu hình của hồ sơ "Mặc định": `<home>/.claude`. */
export function defaultConfigDir(home: string): string {
  return path.join(home, '.claude');
}

/** Thư mục chứa các hồ sơ khác: `<home>/.claude-profiles`. */
export function profilesRoot(home: string): string {
  return path.join(home, '.claude-profiles');
}

/** Thư mục cấu hình của một hồ sơ: `<home>/.claude-profiles/<id>`. */
export function profileDir(home: string, id: string): string {
  return path.join(profilesRoot(home), id);
}

/**
 * Khoá dùng để gắn thư mục với hồ sơ. Hai đường dẫn chỉ thông một thư mục phải cho cùng khoá:
 * Unicode NFC (macOS trả tên tiếng Việt dạng NFD), bỏ dấu gạch cuối (trừ gốc),
 * và trên Windows thì coi `/` như `\` và không phân biệt hoa thường.
 */
export function normalizeFolderKey(fsPath: string, platform: NodeJS.Platform): string {
  const p = platform === 'win32' ? path.win32 : path.posix;
  let key = p.normalize(fsPath.normalize('NFC'));
  const root = p.parse(key).root;
  while (key.length > root.length && key.endsWith(p.sep)) key = key.slice(0, -1);
  return platform === 'win32' ? key.toLowerCase() : key;
}
