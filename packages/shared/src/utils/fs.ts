import { resolve } from 'path';

export function resolveSafe(baseDir: string, relativePath: string): string {
  const resolvedBase = resolve(baseDir);
  const resolvedTarget = resolve(baseDir, relativePath);
  
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new Error('Path traversal detected');
  }
  
  return resolvedTarget;
}
