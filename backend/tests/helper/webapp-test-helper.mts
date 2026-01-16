import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function ensureDirs(root: string, ...dirs: string[]): void {
  for (const dir of dirs) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
}

export function writeTextFile(filePath: string, content: string, encoding: BufferEncoding = "utf-8"): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, encoding);
}

export function listFilesRecursive(root: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (ent.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out.sort();
}
