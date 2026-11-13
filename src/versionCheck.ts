function parse(version: string): number[] | undefined {
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version.trim());
  return m ? [m[1], m[2], m[3]].map((part) => Number(part ?? 0)) : undefined;
}

/** `installed` có từ bản `min` trở lên không, so từng phần major.minor.patch (bỏ hậu tố pre-release). */
export function isSupported(installed: string | undefined, min: string): boolean {
  const a = installed === undefined ? undefined : parse(installed);
  const b = parse(min);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}
