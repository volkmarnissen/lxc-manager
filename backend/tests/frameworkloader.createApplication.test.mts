import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StorageContext } from "@src/storagecontext.mjs";
import { FrameworkLoader } from "@src/frameworkloader.mjs";
import { VEConfigurationError } from "@src/backend-types.mjs";
import { IPostFrameworkCreateApplicationBody } from "@src/types.mjs";

describe("FrameworkLoader.createApplicationFromFramework", () => {
  let tempDir: string;
  let repoRoot: string;
  let storage: StorageContext;
  let loader: FrameworkLoader;

  beforeEach(() => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    repoRoot = path.resolve(__dirname, "..", "..");
    tempDir = mkdtempSync(path.join(os.tmpdir(), "lxc-fw-create-"));
    const storageContextFile = path.join(tempDir, "storagecontext.json");
    const secretFile = path.join(tempDir, "secret.txt");

    StorageContext.setInstance(tempDir, storageContextFile, secretFile);
    storage = StorageContext.getInstance();
    loader = new FrameworkLoader(
      {
        localPath: tempDir,
        jsonPath: path.join(repoRoot, "json"),
        schemaPath: path.join(repoRoot, "schemas"),
      },
      storage,
    );
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("creates a valid application from framework", async () => {
    const request: IPostFrameworkCreateApplicationBody = {
      frameworkId: "npm-nodejs",
      applicationId: "test-app",
      name: "Test Application",
      description: "A test application created from framework",
      parameterValues: [
        { id: "hostname", value: "test-app" },
        { id: "ostype", value: "alpine" },
        { id: "packages", value: "nodejs npm" },
        { id: "command", value: "test-command" },
        { id: "command_args", value: "--test" },
        { id: "package", value: "test-package" },
        { id: "owned_paths", value: "" },
        { id: "uid", value: "" },
        { id: "group", value: "" },
        { id: "username", value: "testuser" },
        { id: "volumes", value: "data=test" },
      ],
    };

    const applicationId = await loader.createApplicationFromFramework(request);
    expect(applicationId).toBe("test-app");

    // Verify application.json exists and is valid
    const appJsonPath = path.join(tempDir, "applications", "test-app", "application.json");
    expect(existsSync(appJsonPath)).toBe(true);

    const validator = storage.getJsonValidator();
    const appData = validator.serializeJsonFileWithSchema(appJsonPath, "application.schema.json");
    expect(appData.name).toBe("Test Application");
    expect(appData.description).toBe("A test application created from framework");
    expect(appData.extends).toBe("npm-nodejs");
    expect(Array.isArray(appData.installation)).toBe(true);
    // The first template should be derived from application-id
    expect(appData.installation?.[0]).toBe("test-app-parameters.json");

    // Verify test-app-parameters.json exists and is valid
    const setParamsPath = path.join(tempDir, "applications", "test-app", "templates", "test-app-parameters.json");
    expect(existsSync(setParamsPath)).toBe(true);

    const templateData = validator.serializeJsonFileWithSchema(setParamsPath, "template.schema.json");
    expect(templateData.name).toBe("Set Parameters");
    expect(Array.isArray(templateData.commands)).toBe(true);
    expect(templateData.commands.length).toBeGreaterThan(0);
  });

  it("throws error if application already exists in localPath", async () => {
    // Create existing application directory
    const existingAppDir = path.join(tempDir, "applications", "existing-app");
    const existingAppJson = path.join(existingAppDir, "application.json");
    require("fs").mkdirSync(existingAppDir, { recursive: true });
    require("fs").writeFileSync(existingAppJson, JSON.stringify({ name: "Existing" }));

    const request: IPostFrameworkCreateApplicationBody = {
      frameworkId: "npm-nodejs",
      applicationId: "existing-app",
      name: "Test Application",
      description: "A test application",
      parameterValues: [],
    };

    await expect(loader.createApplicationFromFramework(request)).rejects.toThrow(
      "already exists at",
    );
  });

  it("throws error if application already exists in jsonPath", async () => {
    const request: IPostFrameworkCreateApplicationBody = {
      frameworkId: "npm-nodejs",
      applicationId: "node-red", // This exists in json/applications
      name: "Test Application",
      description: "A test application",
      parameterValues: [],
    };

    await expect(loader.createApplicationFromFramework(request)).rejects.toThrow(
      "already exists at",
    );
  });

  it("throws error for invalid framework", async () => {
    const request: IPostFrameworkCreateApplicationBody = {
      frameworkId: "non-existent-framework",
      applicationId: "test-app",
      name: "Test Application",
      description: "A test application",
      parameterValues: [],
    };

    await expect(loader.createApplicationFromFramework(request)).rejects.toThrow();
  });
});

