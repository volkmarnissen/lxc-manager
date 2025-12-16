import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { StorageContext } from "@src/storagecontext.mjs";

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lxc-manager-test-"));
  // Ensure required directories exist to satisfy StorageContext constructor
  fs.mkdirSync(path.join(dir, "json"), { recursive: true });
  fs.mkdirSync(path.join(dir, "schemas"), { recursive: true });
  return dir;
}

describe("StorageContext.listApplications", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = createTempDir();
    StorageContext.setInstance(tmp);
  });

  it("returns more than one application and first has name/description", () => {
    const storage = StorageContext.getInstance();
    const apps = storage.listApplications();

    expect(Array.isArray(apps)).toBe(true);
    expect(apps.length).toBeGreaterThan(1);

    const first = apps[0] as any;
    expect(typeof first?.name).toBe("string");
    expect((first?.name as string).length).toBeGreaterThan(0);
    expect(typeof first?.description).toBe("string");
    expect((first?.description as string).length).toBeGreaterThan(0);
  });
});
