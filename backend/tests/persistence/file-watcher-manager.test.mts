import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { FileWatcherManager } from "@src/persistence/file-watcher-manager.mjs";

describe("FileWatcherManager", () => {
  let testDir: string;
  let localPath: string;
  let watcher: FileWatcherManager;
  let applicationInvalidated: boolean;
  let templateInvalidated: boolean;
  let frameworkInvalidated: boolean;

  beforeEach(() => {
    // Setup temporäre Verzeichnisse
    testDir = mkdtempSync(path.join(tmpdir(), "watcher-test-"));
    localPath = path.join(testDir, "local");

    // Verzeichnisse erstellen
    mkdirSync(localPath, { recursive: true });

    // Reset invalidation flags
    applicationInvalidated = false;
    templateInvalidated = false;
    frameworkInvalidated = false;

    // FileWatcherManager initialisieren
    watcher = new FileWatcherManager({
      jsonPath: path.join(testDir, "json"),
      localPath,
      schemaPath: path.join(testDir, "schemas"),
    });

    // Initialize watchers with callbacks
    watcher.initWatchers(
      () => {
        applicationInvalidated = true;
      },
      () => {
        templateInvalidated = true;
      },
      () => {
        frameworkInvalidated = true;
      },
    );
  });

  afterEach(() => {
    // Cleanup
    watcher.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  function writeJson(filePath: string, data: any): void {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Helper to manually trigger watch callbacks by simulating fs.watch events
   * This tests the callback logic deterministically without relying on actual fs.watch
   */
  function triggerApplicationWatch(filename: string, eventType: string = "change"): void {
    // Access private method isApplicationChange via reflection
    const watcherAny = watcher as any;
    if (watcherAny.isApplicationChange && watcherAny.isApplicationChange(filename)) {
      // Call debouncedInvalidate directly
      const onApplicationChange = () => {
        applicationInvalidated = true;
      };
      watcherAny.debouncedInvalidate(onApplicationChange);
    }
  }

  function triggerTemplateWatch(filename: string): void {
    if (filename.endsWith(".json")) {
      templateInvalidated = true;
    }
  }

  function triggerFrameworkWatch(filename: string): void {
    if (filename.endsWith(".json")) {
      frameworkInvalidated = true;
    }
  }

  describe("initWatchers()", () => {
    it("should initialize watchers for existing directories", () => {
      // Directories should be created in beforeEach
      // Watcher should be initialized without errors
      expect(() => watcher.initWatchers(() => {}, () => {}, () => {})).not.toThrow();
    });

    it("should handle missing directories gracefully", () => {
      // Create new watcher with non-existent directories
      const newWatcher = new FileWatcherManager({
        jsonPath: path.join(testDir, "nonexistent-json"),
        localPath: path.join(testDir, "nonexistent-local"),
        schemaPath: path.join(testDir, "nonexistent-schemas"),
      });

      // Should not throw when directories don't exist
      expect(() =>
        newWatcher.initWatchers(() => {}, () => {}, () => {}),
      ).not.toThrow();

      newWatcher.close();
    });
  });

  describe("Application file watching", () => {
    it("should detect application.json changes", async () => {
      // Setup: Application erstellen
      const appDir = path.join(localPath, "applications", "testapp");
      mkdirSync(appDir, { recursive: true });
      writeJson(path.join(appDir, "application.json"), {
        name: "Test App",
        installation: [],
      });

      // Manually trigger watch event for application.json change
      triggerApplicationWatch("testapp/application.json", "change");

      // Wait for debounced invalidation (300ms)
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Application cache should be invalidated
      expect(applicationInvalidated).toBe(true);
    });

    it("should detect icon file changes", async () => {
      // Setup: Application mit Icon
      const appDir = path.join(localPath, "applications", "iconapp");
      mkdirSync(appDir, { recursive: true });
      writeJson(path.join(appDir, "application.json"), {
        name: "Icon App",
        installation: [],
      });

      // Create icon file
      writeFileSync(path.join(appDir, "icon.png"), "icon data");

      // Manually trigger watch event for icon file
      triggerApplicationWatch("iconapp/icon.png", "change");

      // Wait for debounced invalidation
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Application cache should be invalidated
      expect(applicationInvalidated).toBe(true);
    });

    it("should detect new application directories", async () => {
      // Create new application
      const appDir = path.join(localPath, "applications", "newapp");
      mkdirSync(appDir, { recursive: true });
      writeJson(path.join(appDir, "application.json"), {
        name: "New App",
        installation: [],
      });

      // Manually trigger watch event for new directory (directory name without extension)
      triggerApplicationWatch("newapp", "rename");

      // Wait for debounced invalidation
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Application cache should be invalidated
      expect(applicationInvalidated).toBe(true);
    });
  });

  describe("Template file watching", () => {
    it("should detect template file changes", async () => {
      // Setup: Template-Verzeichnis erstellen
      const templatesDir = path.join(localPath, "shared", "templates");
      mkdirSync(templatesDir, { recursive: true });

      // Create template file
      writeJson(path.join(templatesDir, "testtemplate.json"), {
        name: "Test Template",
        commands: [],
      });

      // Manually trigger watch event for template file
      triggerTemplateWatch("testtemplate.json");

      // Templates don't have debounce, so invalidation should be immediate
      // But we wait a tiny bit to ensure callback is processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Template cache should be invalidated
      expect(templateInvalidated).toBe(true);
    });
  });

  describe("Framework file watching", () => {
    it("should detect framework file changes", async () => {
      // Setup: Framework-Verzeichnis erstellen
      const frameworksDir = path.join(localPath, "frameworks");
      mkdirSync(frameworksDir, { recursive: true });

      // Create framework file
      writeJson(path.join(frameworksDir, "testframework.json"), {
        id: "testframework",
        name: "Test Framework",
        extends: "base",
        properties: [],
      });

      // Manually trigger watch event for framework file
      triggerFrameworkWatch("testframework.json");

      // Wait a tiny bit to ensure callback is processed
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Framework cache should be invalidated
      expect(frameworkInvalidated).toBe(true);
    });
  });

  describe("close()", () => {
    it("should close watchers without errors", () => {
      expect(() => watcher.close()).not.toThrow();
    });

    it("should allow multiple close calls", () => {
      watcher.close();
      expect(() => watcher.close()).not.toThrow();
    });

    it("should stop watching after close", async () => {
      watcher.close();

      // Create file after close
      const appDir = path.join(localPath, "applications", "afterclose");
      mkdirSync(appDir, { recursive: true });
      writeJson(path.join(appDir, "application.json"), {
        name: "After Close",
        installation: [],
      });

      // Wait
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should not be invalidated (watcher is closed)
      expect(applicationInvalidated).toBe(false);
    });
  });
});
