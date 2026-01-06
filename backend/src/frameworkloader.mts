import path from "path";
import fs from "fs";
import { ApplicationLoader } from "./apploader.mjs";
import {
  IConfiguredPathes,
  IFramework,
  VEConfigurationError,
  IReadApplicationOptions,
} from "./backend-types.mjs";
import { StorageContext } from "./storagecontext.mjs";
import { JsonError } from "./jsonvalidator.mjs";
import { TemplateProcessor } from "./templateprocessor.mjs";
import { TaskType, IParameter } from "./types.mjs";
import { IVEContext } from "./backend-types.mjs";

export interface IReadFrameworkOptions {
  framework?: IFramework;
  frameworkPath?: string;
  error: VEConfigurationError;
}

export class FrameworkLoader {
  constructor(
    private pathes: IConfiguredPathes,
    private storage: StorageContext = StorageContext.getInstance(),
    private applicationLoader?: ApplicationLoader,
  ) {
    this.applicationLoader =
      this.applicationLoader ?? new ApplicationLoader(this.pathes, this.storage);
  }

  public readFrameworkJson(
    framework: string,
    opts: IReadFrameworkOptions,
  ): IFramework {
    let frameworkPath: string | undefined;
    let frameworkFile: string | undefined;
    let frameworkName = framework;

    if (framework.startsWith("json:")) {
      frameworkName = framework.replace(/^json:/, "");
      frameworkPath = path.join(this.pathes.jsonPath, "frameworks");
      frameworkFile = path.join(frameworkPath, `${frameworkName}.json`);
      if (!fs.existsSync(frameworkFile)) {
        throw new Error(`framework json not found for ${framework}`);
      }
    } else {
      const localFile = path.join(
        this.pathes.localPath,
        "frameworks",
        `${framework}.json`,
      );
      const jsonFile = path.join(
        this.pathes.jsonPath,
        "frameworks",
        `${framework}.json`,
      );
      if (fs.existsSync(localFile)) {
        frameworkFile = localFile;
        frameworkPath = path.dirname(localFile);
      } else if (fs.existsSync(jsonFile)) {
        frameworkFile = jsonFile;
        frameworkPath = path.dirname(jsonFile);
      } else {
        throw new Error(`framework json not found for ${framework}`);
      }
    }

    const validator = this.storage.getJsonValidator();
    let frameworkData: IFramework;
    try {
      frameworkData = validator.serializeJsonFileWithSchema<IFramework>(
        frameworkFile,
        "framework",
      );
    } catch (e: Error | any) {
      this.addErrorToOptions(opts, e);
      throw opts.error;
    }

    frameworkData.id = frameworkName;
    opts.framework = frameworkData;
    opts.frameworkPath = frameworkPath;
    return frameworkData;
  }

  public async getParameters(
    framework: string,
    task: TaskType,
    veContext: IVEContext,
  ): Promise<IParameter[]> {
    const opts: IReadFrameworkOptions = {
      error: new VEConfigurationError("", framework),
    };
    const frameworkData = this.readFrameworkJson(framework, opts);

    const appOpts: IReadApplicationOptions = {
      applicationHierarchy: [],
      error: new VEConfigurationError("", frameworkData.extends),
      taskTemplates: [],
    };
    // Validate and load base application (errors are collected in appOpts)
    try {
      this.applicationLoader!.readApplicationJson(
        frameworkData.extends,
        appOpts,
      );
    } catch (e: Error | any) {
      this.addErrorToOptions(opts, e);
    }

    const templateProcessor = new TemplateProcessor(this.pathes, this.storage);
    const loaded = await templateProcessor.getParameters(
      frameworkData.extends,
      task,
      veContext,
    );

    const propertyIds = (frameworkData.properties || []).map((p) =>
      typeof p === "string" ? p : p.id,
    );
    const result: IParameter[] = [];
    for (const propId of propertyIds) {
      const match = loaded.find((p) => p.id === propId);
      if (match) {
        // Clone parameter and apply framework-specific rules:
        // - remove 'advanced'
        // - force required: true
        const cloned: IParameter = { ...match };
        delete (cloned as any).advanced;
        cloned.required = true;
        result.push(cloned);
      }
    }
    return result;
  }

  private addErrorToOptions(opts: IReadFrameworkOptions, error: Error | any) {
    if (opts.error && Array.isArray(opts.error.details)) {
      opts.error.details.push(error);
    } else if (opts.error) {
      opts.error.details = [error];
    } else {
      throw new JsonError(error?.message || String(error));
    }
  }
}

