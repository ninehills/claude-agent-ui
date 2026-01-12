import type { Dirent } from 'fs';
import { readdir, stat } from 'fs/promises';
import { basename, join, relative, resolve } from 'path';

export type DirectoryEntry = {
  path: string;
  type: 'file' | 'dir';
  depth: number;
};

export type DirectoryInfo = {
  root: string;
  summary: {
    totalFiles: number;
    totalDirs: number;
  };
  entries: DirectoryEntry[];
  truncated: boolean;
};

export type DirectoryTreeNode = {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: DirectoryTreeNode[];
};

export type DirectoryTree = {
  root: string;
  summary: {
    totalFiles: number;
    totalDirs: number;
  };
  tree: DirectoryTreeNode;
  truncated: boolean;
};

const DEFAULT_IGNORES = new Set(['.git', 'node_modules', 'out', 'dist', 'tmp']);

export async function buildDirectoryInfo(
  root: string,
  options?: {
    maxDepth?: number;
    maxEntries?: number;
    ignores?: Set<string>;
  }
): Promise<DirectoryInfo> {
  const maxDepth = options?.maxDepth ?? 3;
  const maxEntries = options?.maxEntries ?? 500;
  const ignores = options?.ignores ?? DEFAULT_IGNORES;

  const entries: DirectoryEntry[] = [];
  let totalFiles = 0;
  let totalDirs = 0;
  let truncated = false;

  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];

  while (queue.length > 0 && entries.length < maxEntries) {
    const { dir, depth } = queue.shift()!;
    let dirEntries: Dirent[];
    try {
      dirEntries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of dirEntries) {
      const name = entry.name;
      if (entries.length >= maxEntries) {
        truncated = true;
        break;
      }

      if (ignores.has(name)) {
        continue;
      }

      const fullPath = join(dir, name);
      const relPath = relative(root, fullPath) || name;
      const entryDepth = depth + 1;

      if (entry.isDirectory()) {
        totalDirs += 1;
        entries.push({ path: relPath, type: 'dir', depth: entryDepth });
        if (entryDepth < maxDepth) {
          queue.push({ dir: fullPath, depth: entryDepth });
        }
      } else if (entry.isFile()) {
        totalFiles += 1;
        entries.push({ path: relPath, type: 'file', depth: entryDepth });
      } else {
        try {
          const info = await stat(fullPath);
          if (info.isDirectory()) {
            totalDirs += 1;
            entries.push({ path: relPath, type: 'dir', depth: entryDepth });
            if (entryDepth < maxDepth) {
              queue.push({ dir: fullPath, depth: entryDepth });
            }
          } else if (info.isFile()) {
            totalFiles += 1;
            entries.push({ path: relPath, type: 'file', depth: entryDepth });
          }
        } catch {
          continue;
        }
      }
    }
  }

  if (entries.length >= maxEntries) {
    truncated = true;
  }

  return {
    root,
    summary: { totalFiles, totalDirs },
    entries,
    truncated
  };
}

export async function buildDirectoryTree(
  root: string,
  options?: {
    maxDepth?: number;
    maxEntries?: number;
    ignores?: Set<string>;
  }
): Promise<DirectoryTree> {
  const maxDepth = options?.maxDepth ?? 6;
  const maxEntries = options?.maxEntries ?? 2000;
  const ignores = options?.ignores ?? DEFAULT_IGNORES;

  let totalFiles = 0;
  let totalDirs = 0;
  let truncated = false;
  let entriesCount = 0;

  const rootPath = resolve(root);

  const walk = async (dir: string, relPath: string, depth: number): Promise<DirectoryTreeNode> => {
    const node: DirectoryTreeNode = {
      id: relPath || 'root',
      name: relPath ? basename(relPath) : '.',
      path: relPath,
      type: 'dir',
      children: []
    };

    if (depth >= maxDepth || truncated) {
      return node;
    }

    let dirEntries: Dirent[];
    try {
      dirEntries = await readdir(dir, { withFileTypes: true });
    } catch {
      return node;
    }

    const sorted = dirEntries
      .filter((entry) => !ignores.has(entry.name))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      if (entriesCount >= maxEntries) {
        truncated = true;
        break;
      }

      const childRelPath = relPath ? join(relPath, entry.name) : entry.name;
      const fullPath = resolve(rootPath, childRelPath);

      if (entry.isDirectory()) {
        totalDirs += 1;
        entriesCount += 1;
        const childNode = await walk(fullPath, childRelPath, depth + 1);
        node.children?.push(childNode);
      } else if (entry.isFile()) {
        totalFiles += 1;
        entriesCount += 1;
        node.children?.push({
          id: childRelPath,
          name: entry.name,
          path: childRelPath,
          type: 'file'
        });
      } else {
        try {
          const info = await stat(fullPath);
          if (info.isDirectory()) {
            totalDirs += 1;
            entriesCount += 1;
            const childNode = await walk(fullPath, childRelPath, depth + 1);
            node.children?.push(childNode);
          } else if (info.isFile()) {
            totalFiles += 1;
            entriesCount += 1;
            node.children?.push({
              id: childRelPath,
              name: entry.name,
              path: childRelPath,
              type: 'file'
            });
          }
        } catch {
          continue;
        }
      }
    }

    return node;
  };

  const tree = await walk(rootPath, '', 0);

  return {
    root: rootPath,
    summary: { totalFiles, totalDirs },
    tree,
    truncated
  };
}
