import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { StorageContext } from "@src/storagecontext.mjs";
import { TemplateProcessor } from "@src/templateprocessor.mts";

describe("TemplateProcessor skip_if_all_missing - outputs should not be set when skipped", () => {
  let testDir: string;
  let secretFilePath: string;
  let storage: StorageContext;
  let tp: TemplateProcessor;
  const veContext = { host: "localhost", port: 22 } as any;

  beforeAll(() => {
    // Create a temporary directory for the test
    testDir = mkdtempSync(path.join(tmpdir(), "templateprocessor-skip-outputs-test-"));
    secretFilePath = path.join(testDir, "secret.txt");

    // StorageContext uses rootDirname which is "../../" relative to backend/src
    const __filename = new URL(import.meta.url).pathname;
    const backendDir = path.dirname(__filename);
    const repoRoot = path.join(backendDir, "../..");
    const jsonDir = path.join(repoRoot, "json");
    const applicationsDir = path.join(jsonDir, "applications");
    const testAppDir = path.join(applicationsDir, "test-skip-outputs-app");
    const templatesDir = path.join(testAppDir, "templates");
    
    mkdirSync(templatesDir, { recursive: true });

    // Create a valid storagecontext.json file
    const storageContextPath = path.join(testDir, "storagecontext.json");
    writeFileSync(storageContextPath, JSON.stringify({}), "utf-8");

    // Create application.json that uses templates similar to 104 and 105
    const applicationJson = {
      "name": "Test Skip Outputs Application",
      "description": "Test application for skip_if_all_missing outputs",
      "installation": [
        "set-parameters.json",
        "104-compute-static-ips.json",
        "105-set-static-ip.json"
      ]
    };
    writeFileSync(
      path.join(testAppDir, "application.json"),
      JSON.stringify(applicationJson),
      "utf-8"
    );

    // Create set-parameters.json that does NOT provide ip4_prefix or ip6_prefix
    // This means 104 should be skipped
    const setParametersTemplate = {
      "execute_on": "ve",
      "name": "Set Parameters",
      "description": "Set application-specific parameters",
      "parameters": [
        {
          "id": "hostname",
          "name": "Hostname",
          "type": "string",
          "default": "test",
          "required": true,
          "description": "Hostname for the container"
        },
        {
          "id": "vm_id",
          "name": "VM ID",
          "type": "string",
          "default": "100",
          "required": true,
          "description": "VM ID"
        }
      ],
      "commands": [
        {
          "properties": [
            {
              "id": "hostname",
              "value": "{{hostname}}"
            },
            {
              "id": "vm_id",
              "value": "{{vm_id}}"
            }
          ]
        }
      ]
    };
    writeFileSync(
      path.join(templatesDir, "set-parameters.json"),
      JSON.stringify(setParametersTemplate),
      "utf-8"
    );

    // Create 104-compute-static-ips.json (similar to 104-lxc-static-ip-prefix.json)
    // This template should be skipped because ip4_prefix and ip6_prefix are missing
    // It outputs static_ip and static_ip6, which should NOT be set when skipped
    const template104 = {
      "execute_on": "ve",
      "name": "Compute Static IPs",
      "description": "Derive static IPv4/IPv6 from prefixes and VMID",
      "skip_if_all_missing": ["ip4_prefix", "ip6_prefix"],
      "parameters": [
        {
          "name": "vm_id",
          "id": "vm_id",
          "type": "string",
          "description": "VMID of the container."
        },
        {
          "name": "ip4_prefix",
          "id": "ip4_prefix",
          "type": "string",
          "description": "IPv4 prefix (e.g. 192.168.1)",
          "advanced": true
        },
        {
          "name": "ip6_prefix",
          "id": "ip6_prefix",
          "type": "string",
          "description": "IPv6 prefix (e.g. 2001:db8::)",
          "advanced": true
        }
      ],
      "outputs": [
        { "id": "static_ip" },
        { "id": "static_ip6" }
      ],
      "commands": [
        {
          "name": "Compute Static IPs",
          "command": "echo 'static_ip=192.168.1.100/24' && echo 'static_ip6=2001:db8::100/64'"
        }
      ]
    };
    writeFileSync(
      path.join(templatesDir, "104-compute-static-ips.json"),
      JSON.stringify(template104),
      "utf-8"
    );

    // Create 105-set-static-ip.json (similar to 105-set-static-ip-for-lxc.json)
    // This template should also be skipped because static_ip and static_ip6 are missing
    // (they should not be set by 104 because 104 was skipped)
    const template105 = {
      "execute_on": "ve",
      "name": "Set Static IP for LXC",
      "description": "Edit LXC network settings for a container with static IPs",
      "skip_if_all_missing": ["static_ip", "static_ip6"],
      "parameters": [
        {
          "name": "static_ip",
          "id": "static_ip",
          "type": "string",
          "description": "Static IPv4 address in CIDR notation"
        },
        {
          "name": "static_ip6",
          "id": "static_ip6",
          "type": "string",
          "description": "Static IPv6 address in CIDR notation"
        },
        {
          "name": "vm_id",
          "id": "vm_id",
          "type": "string",
          "description": "VMID of the container."
        }
      ],
      "commands": [
        {
          "name": "Set Static IP",
          "command": "echo 'Setting static IP'"
        }
      ]
    };
    writeFileSync(
      path.join(templatesDir, "105-set-static-ip.json"),
      JSON.stringify(template105),
      "utf-8"
    );

    StorageContext.setInstance(testDir, storageContextPath, secretFilePath);
    storage = StorageContext.getInstance();
    tp = storage.getTemplateProcessor();
  });

  afterAll(() => {
    try {
      if (testDir && require("fs").existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
      const __filename = new URL(import.meta.url).pathname;
      const backendDir = path.dirname(__filename);
      const repoRoot = path.join(backendDir, "../..");
      const testAppDir = path.join(repoRoot, "json", "applications", "test-skip-outputs-app");
      if (require("fs").existsSync(testAppDir)) {
        rmSync(testAppDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should NOT set outputs when template is skipped", async () => {
    // Load the application
    const loaded = await tp.loadApplication(
      "test-skip-outputs-app",
      "installation",
      veContext,
      "sh",
    );

    // Template 104 should be skipped (ip4_prefix and ip6_prefix are missing)
    // Therefore, static_ip and static_ip6 should NOT be in resolvedParams
    
    const resolvedParamIds = loaded.resolvedParams.map((p: any) => p.id);
    
    // These should NOT be present because 104 was skipped
    expect(resolvedParamIds).not.toContain("static_ip");
    expect(resolvedParamIds).not.toContain("static_ip6");
    
    // Template 105 should also be skipped because static_ip and static_ip6 are missing
    // (they were not set by 104 because 104 was skipped)
    const skippedCommand105 = loaded.commands.find((cmd: any) => 
      cmd.name && cmd.name.includes("(skipped)") && cmd.name.includes("Set Static IP")
    );
    
    expect(skippedCommand105).toBeDefined();
    expect(skippedCommand105?.command).toBe("exit 0");
    
    // Template 104 should also be skipped
    const skippedCommand104 = loaded.commands.find((cmd: any) => 
      cmd.name && cmd.name.includes("(skipped)") && cmd.name.includes("Compute Static IPs")
    );
    
    expect(skippedCommand104).toBeDefined();
    expect(skippedCommand104?.command).toBe("exit 0");
  });
});

