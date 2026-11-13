import { constants, promises as fs, type Stats } from 'node:fs';
import path from 'node:path';

/**
 * File được chép từ `~/.claude` vào hồ sơ mới, không liên kết: Claude Code lưu file bằng cách thay file,
 * làm gãy mọi symlink/hard link (bản thử Task 1, Step 7b).
 */
export const SEED_FILES = ['settings.json', 'CLAUDE.md'] as const;
/** Thư mục dùng chung qua junction (Windows) hoặc symlink thư mục; Claude Code ghi vào bên trong nên liên kết giữ được. */
export const SHARED_DIRS = ['skills', 'plugins', 'commands', 'projects'] as const;

export interface LinkReport { linked: string[]; copied: string[]; skipped: string[] }

async function lstatOrUndefined(p: string): Promise<Stats | undefined> {
  try {
    return await fs.lstat(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

async function samePath(a: string, b: string): Promise<boolean> {
  try {
    return (await fs.realpath(a)) === (await fs.realpath(b));
  } catch {
    return false;
  }
}

/** Gỡ một liên kết mà không đụng tới đích. Junction trên Windows là thư mục nên có thể cần `rmdir`. */
async function removeLink(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'EPERM' && code !== 'EISDIR') throw err;
    await fs.rmdir(p);
  }
}

/** Xoá đệ quy nhưng không bao giờ đi xuyên liên kết: gặp liên kết thì chỉ gỡ chính liên kết. */
async function removeTreeNoFollow(p: string): Promise<void> {
  const st = await lstatOrUndefined(p);
  if (!st) return;
  if (st.isSymbolicLink()) return removeLink(p);
  if (st.isDirectory()) {
    for (const name of await fs.readdir(p)) await removeTreeNoFollow(path.join(p, name));
    await fs.rmdir(p);
    return;
  }
  try {
    await fs.unlink(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EPERM') throw err;
    await fs.chmod(p, 0o666); // file chỉ đọc trên Windows
    await fs.unlink(p);
  }
}

/**
 * Nối phần dùng chung của hồ sơ về thư mục mặc định. Không ghi đè gì đã có trong hồ sơ.
 * - Thư mục: tạo nguồn rỗng nếu chưa có, rồi liên kết. Đã là liên kết tới đúng nguồn thì tính là `linked`.
 * - File: chép nếu nguồn có và hồ sơ chưa có.
 */
export async function linkShared(defaultDir: string, profileDir: string, platform: NodeJS.Platform): Promise<LinkReport> {
  const report: LinkReport = { linked: [], copied: [], skipped: [] };
  await fs.mkdir(profileDir, { recursive: true });

  for (const name of SHARED_DIRS) {
    const src = path.join(defaultDir, name);
    const dest = path.join(profileDir, name);
    await fs.mkdir(src, { recursive: true });
    const st = await lstatOrUndefined(dest);
    if (!st) {
      await fs.symlink(src, dest, platform === 'win32' ? 'junction' : 'dir');
      report.linked.push(name);
    } else if (st.isSymbolicLink() && (await samePath(dest, src))) {
      report.linked.push(name);
    } else {
      report.skipped.push(name);
    }
  }

  for (const name of SEED_FILES) {
    const src = path.join(defaultDir, name);
    const dest = path.join(profileDir, name);
    const srcStat = await lstatOrUndefined(src);
    if (!srcStat || (await lstatOrUndefined(dest))) {
      report.skipped.push(name);
      continue;
    }
    await fs.copyFile(src, dest, constants.COPYFILE_EXCL);
    report.copied.push(name);
  }
  return report;
}

/**
 * Chuẩn bị thư mục của hồ sơ trước mỗi lần Claude Code có thể dùng nó (chọn hồ sơ, đăng nhập, kích hoạt, xoá thất bại):
 * tạo lại thư mục nếu mất và nối lại phần dùng chung, không ghi đè gì. Nếu bỏ qua bước này, Claude Code tự tạo
 * `projects/` thật trong hồ sơ, lịch sử tách ra mà không ai biết, và lần xoá hồ sơ sau sẽ xoá luôn phần đó.
 * Trả về các thư mục dùng chung không nối được (đã có sẵn dạng thư mục thật) để cảnh báo.
 */
export async function prepareProfileDir(
  profile: { configDir: string; isDefault: boolean }, defaultDir: string, platform: NodeJS.Platform,
): Promise<string[]> {
  if (profile.isDefault) return [];
  const report = await linkShared(defaultDir, profile.configDir, platform);
  return report.skipped.filter((name) => (SHARED_DIRS as readonly string[]).includes(name));
}

/** Gỡ mọi liên kết ở cấp đầu của thư mục hồ sơ. Không xoá file hay thư mục thường. */
export async function unlinkShared(profileDir: string): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(profileDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
  for (const name of names) {
    const p = path.join(profileDir, name);
    if ((await lstatOrUndefined(p))?.isSymbolicLink()) await removeLink(p);
  }
}

/**
 * Xoá thư mục hồ sơ mà không đụng dữ liệu dùng chung.
 * Chỉ chấp nhận thư mục nằm hẳn bên trong `root`; gỡ liên kết trước, kiểm tra lại, rồi xoá không đi xuyên liên kết.
 */
export async function removeProfileDir(profileDir: string, root: string): Promise<void> {
  const rel = path.relative(path.resolve(root), path.resolve(profileDir));
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Từ chối xoá ${profileDir}: không nằm trong ${root}.`);
  }
  const st = await lstatOrUndefined(profileDir);
  if (!st) return;
  if (st.isSymbolicLink()) throw new Error(`Từ chối xoá ${profileDir}: bản thân nó là liên kết.`);

  await unlinkShared(profileDir);
  for (const name of SHARED_DIRS) {
    if ((await lstatOrUndefined(path.join(profileDir, name)))?.isSymbolicLink()) {
      throw new Error(`Từ chối xoá ${profileDir}: không gỡ được liên kết ${name}.`);
    }
  }
  await removeTreeNoFollow(profileDir);
}
