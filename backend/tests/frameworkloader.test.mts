import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { StorageContext } from "@src/storagecontext.mjs";
import { FrameworkLoader } from "@src/frameworkloader.mjs";
import { VEConfigurationError, IVEContext } from "@src/backend-types.mjs";

describe("FrameworkLoader", () => {
  it("returns parameters matching framework properties and enforces required/non-advanced", async () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRoot = path.resolve(__dirname, "..", "..");
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "lxc-fw-"));
    const storageContextFile = path.join(tempDir, "storagecontext.json");
    const secretFile = path.join(tempDir, "secret.txt");

    StorageContext.setInstance(
      path.join(repoRoot, "local"),
      storageContextFile,
      secretFile,
    );
    const storage = StorageContext.getInstance();
    const loader = new FrameworkLoader(
      {
        localPath: path.join(repoRoot, "local"),
        jsonPath: path.join(repoRoot, "json"),
        schemaPath: path.join(repoRoot, "schemas"),
      },
      storage,
    );

    const framework = loader.readFrameworkJson("npm-nodejs", {
      error: new VEConfigurationError("", "npm-nodejs"),
    });
    const veContext: IVEContext = {
      host: "validation-dummy",
      getStorageContext: () => storage,
      getKey: () => "ve_validation",
    };

    const parameters = await loader.getParameters(
      "npm-nodejs",
      "installation",
      veContext,
    );
    expect(parameters.length).toBe(framework.properties.length);
    for (const param of parameters) {
      expect(param.required).toBe(true);
      expect((param as any).advanced).toBeUndefined();
    }
  });
});

