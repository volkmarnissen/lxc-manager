import path from "node:path";
import fs from "fs";
import { fileURLToPath } from "url";
import { JsonValidator } from "./jsonvalidator.mjs";

function findTemplateDirs(dir: string): string[] {
  let results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "templates") {
        results.push(fullPath);
      } else {
        results = results.concat(findTemplateDirs(fullPath));
      }
    }
  }
  return results;
}

function findApplicationFiles(dir: string): string[] {
  let results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Check if there's an application.json in this directory
      const appJsonPath = path.join(fullPath, "application.json");
      if (fs.existsSync(appJsonPath)) {
        results.push(appJsonPath);
      }
      // Recurse into subdirectories
      results = results.concat(findApplicationFiles(fullPath));
    }
  }
  return results;
}

export async function validateAllJson(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "..");
  const rootDir = path.resolve(projectRoot, "..");
  const schemasDir = path.join(rootDir, "schemas");
  const jsonBase = path.join(rootDir, "json");

  let hasError = false;

  // Initialize validator
  let validator: JsonValidator;
  try {
    validator = new JsonValidator(schemasDir);
  } catch (err: any) {
    console.error("Schema validation failed during validator initialization:");
    if (err && err.details) {
      for (const detail of err.details) {
        console.error(`  - ${detail.message || detail}`);
      }
    } else {
      console.error(err);
    }
    process.exit(2);
  }

  // Validate templates
  console.log("Validating templates...");
  const templateDirs = findTemplateDirs(rootDir);
  const templateSchemaPath = path.join(schemasDir, "template.schema.json");

  for (const dir of templateDirs) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const filePath = path.join(dir, file);
      const relPath = path.relative(jsonBase, filePath);
      try {
        validator.serializeJsonFileWithSchema(filePath, templateSchemaPath);
        console.log(`✔ Valid template: ${relPath}`);
      } catch (err: any) {
        hasError = true;
        const schemaName = path.basename(templateSchemaPath);
        console.error(`✖ Invalid template: ${relPath} [${schemaName}]`);
        if (err && err.details) {
          for (const detail of err.details) {
            const isAdditional =
              detail.message &&
              detail.message.includes("must NOT have additional properties");
            if (
              isAdditional &&
              detail.params &&
              detail.params.additionalProperty
            ) {
              console.error(
                `  - ${detail.message} (property: '${detail.params.additionalProperty}')${detail.line ? " (line " + detail.line + ")" : ""}`,
              );
            } else {
              console.error(
                `  - ${detail.message}${detail.line ? " (line " + detail.line + ")" : ""}`,
              );
            }
          }
        } else {
          console.error(err);
        }
      }
    }
  }

  // Validate applications
  console.log("\nValidating applications...");
  const applicationFiles = findApplicationFiles(
    path.join(rootDir, "json", "applications"),
  );
  const applicationSchemaPath = path.join(schemasDir, "application.schema.json");

  for (const filePath of applicationFiles) {
    const relPath = path.relative(jsonBase, filePath);
    try {
      validator.serializeJsonFileWithSchema(filePath, applicationSchemaPath);
      console.log(`✔ Valid application: ${relPath}`);
    } catch (err: any) {
      hasError = true;
      const schemaName = path.basename(applicationSchemaPath);
      console.error(`✖ Invalid application: ${relPath} [${schemaName}]`);
      if (err && err.details) {
        for (const detail of err.details) {
          const isAdditional =
            detail.message &&
            detail.message.includes("must NOT have additional properties");
          if (
            isAdditional &&
            detail.params &&
            detail.params.additionalProperty
          ) {
            console.error(
              `  - ${detail.message} (property: '${detail.params.additionalProperty}')${detail.line ? " (line " + detail.line + ")" : ""}`,
            );
          } else {
            console.error(
              `  - ${detail.message}${detail.line ? " (line " + detail.line + ")" : ""}`,
            );
          }
        }
      } else {
        console.error(err);
      }
    }
  }

  if (hasError) {
    console.error("\nValidation failed. Please fix the errors above.");
    process.exit(1);
  } else {
    console.log("\nAll templates and applications are valid.");
  }
}

