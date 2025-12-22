import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { VeExecution } from "@src/ve-execution.mjs";
import { ICommand, IVeExecuteMessage } from "@src/types.mjs";
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { IVEContext } from "@src/backend-types.mjs";
import { StorageContext } from "@src/storagecontext.mjs";

const dummyVE: IVEContext = { host: "localhost", port: 22 } as IVEContext;
let testDir: string;
let secretFilePath: string;

beforeAll(() => {
  // Create a temporary directory for the test
  testDir = mkdtempSync(path.join(os.tmpdir(), "ve-execution-properties-test-"));
  secretFilePath = path.join(testDir, "secret.txt");

  // Create a valid storagecontext.json file
  const storageContextPath = path.join(testDir, "storagecontext.json");
  fs.writeFileSync(storageContextPath, JSON.stringify({}), "utf-8");

  StorageContext.setInstance(testDir, storageContextPath, secretFilePath);
});

afterAll(() => {
  // Cleanup test directory
  try {
    if (testDir && fs.existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
});

describe("VeExecution properties", () => {
  it("should process properties command with variable replacement in values", async () => {
    // Test based on set-parameters.json template
    const commands: ICommand[] = [
      {
        name: "set-parameters",
        properties: [
          { id: "ostype", value: "debian" },
          { id: "volumes", value: "data=timemachine" },
          { id: "envs", value: "USERNAME={{username}}\nPASSWORD={{password}}\nSHARE_NAME={{share_name}}" },
        ],
        execute_on: "ve",
      },
    ];

    const inputs: { id: string; value: string | number | boolean }[] = [
      { id: "username", value: "macbckpsrv" },
      { id: "password", value: "secret123" },
      { id: "share_name", value: "backup" },
    ];

    let capturedMessages: IVeExecuteMessage[] = [];

    class TestExec extends VeExecution {
      protected async runOnVeHost(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _input: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _tmplCommand: ICommand,
      ): Promise<IVeExecuteMessage> {
        // Should not be called for properties command
        throw new Error("runOnVeHost should not be called for properties command");
      }
    }

    const exec = new TestExec(commands, inputs, dummyVE, new Map(), "/bin/sh");
    
    // Capture emitted messages
    exec.on("message", (msg: IVeExecuteMessage) => {
      capturedMessages.push(msg);
    });

    // Execute the command
    await exec.run();

    // Verify that runOnVeHost was not called (no error thrown)
    expect(capturedMessages.length).toBeGreaterThan(0);
    
    // Find the properties message
    const propertiesMsg = capturedMessages.find(
      (msg) => msg.command === "set-parameters" && msg.exitCode === 0
    );
    expect(propertiesMsg).toBeDefined();

    // Verify outputs were set correctly
    expect(exec.outputs.get("ostype")).toBe("debian");
    expect(exec.outputs.get("volumes")).toBe("data=timemachine");
    
    // Verify that variables in envs were replaced
    const envsValue = exec.outputs.get("envs");
    expect(envsValue).toBeDefined();
    expect(typeof envsValue).toBe("string");
    
    const envsStr = envsValue as string;
    // Check that variables were replaced
    expect(envsStr).toContain("USERNAME=macbckpsrv");
    expect(envsStr).toContain("PASSWORD=secret123");
    expect(envsStr).toContain("SHARE_NAME=backup");
    
    // Verify that the original variable placeholders are not present
    expect(envsStr).not.toContain("{{username}}");
    expect(envsStr).not.toContain("{{password}}");
    expect(envsStr).not.toContain("{{share_name}}");
    
    // Verify the format is correct (newline-separated)
    const envsLines = envsStr.split("\n");
    expect(envsLines).toContain("USERNAME=macbckpsrv");
    expect(envsLines).toContain("PASSWORD=secret123");
    expect(envsLines).toContain("SHARE_NAME=backup");
  });

  it("should handle properties with single object", async () => {
    const commands: ICommand[] = [
      {
        name: "set-single-property",
        properties: {"id":"test_id","value":"test_{{var}}_value"},
        execute_on: "ve",
      },
    ];

    const inputs: { id: string; value: string | number | boolean }[] = [
      { id: "var", value: "replaced" },
    ];

    class TestExec extends VeExecution {
      protected async runOnVeHost(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _input: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _tmplCommand: ICommand,
      ): Promise<IVeExecuteMessage> {
        throw new Error("runOnVeHost should not be called");
      }
    }

    const exec = new TestExec(commands, inputs, dummyVE, new Map(), "/bin/sh");
    await exec.run();

    expect(exec.outputs.get("test_id")).toBe("test_replaced_value");
  });

  it("should handle properties with array of objects", async () => {
    const commands: ICommand[] = [
      {
        name: "set-multiple-properties",
        properties: [
          { id: "prop1", value: "value1" },
          { id: "prop2", value: "value2_{{var}}" },
        ],
        execute_on: "ve",
      },
    ];

    const inputs: { id: string; value: string | number | boolean }[] = [
      { id: "var", value: "test" },
    ];

    class TestExec extends VeExecution {
      protected async runOnVeHost(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _input: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _tmplCommand: ICommand,
      ): Promise<IVeExecuteMessage> {
        throw new Error("runOnVeHost should not be called");
      }
    }

    const exec = new TestExec(commands, inputs, dummyVE, new Map(), "/bin/sh");
    await exec.run();

    expect(exec.outputs.get("prop1")).toBe("value1");
    expect(exec.outputs.get("prop2")).toBe("value2_test");
  });

  it("should handle properties with missing id gracefully", async () => {
    const commands: ICommand[] = [
      {
        name: "invalid-properties",
        properties: { value: "test" } as any, // Missing id
        execute_on: "ve",
      },
    ];

    let capturedMessages: IVeExecuteMessage[] = [];

    class TestExec extends VeExecution {
      protected async runOnVeHost(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _input: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _tmplCommand: ICommand,
      ): Promise<IVeExecuteMessage> {
        throw new Error("runOnVeHost should not be called");
      }
    }

    const exec = new TestExec(commands, [], dummyVE, new Map(), "/bin/sh");
    
    exec.on("message", (msg: IVeExecuteMessage) => {
      capturedMessages.push(msg);
    });

    await exec.run();

    // Should have a success message (missing id is just ignored)
    const successMsg = capturedMessages.find(
      (msg) => msg.command === "invalid-properties" && msg.exitCode === 0
    );
    expect(successMsg).toBeDefined();
    // Outputs should be empty since id was missing
    expect(exec.outputs.size).toBe(0);
  });
});

