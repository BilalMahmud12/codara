#!/usr/bin/env node
import { resolve } from "node:path";
import { analyzeProject, ENGINE_VERSION, SCHEMA_VERSION } from "../application/analyze-project.js";
import { CodaraInvocationError } from "../shared/errors.js";
import { renderSummary } from "./render-summary.js";

const DEFAULT_OUTPUT_FILE = ".codara/analysis.json";

interface ParsedArgs {
  command?: string;
  root: string;
  output: string | false;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    root: ".",
    output: DEFAULT_OUTPUT_FILE,
    help: false,
    version: false,
  };

  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--version" || arg === "-v") {
      args.version = true;
    } else if (arg === "--no-write") {
      args.output = false;
    } else if (arg === "--output") {
      index += 1;
      const value = argv[index];
      if (!value) {
        throw new CodaraInvocationError(
          "missing-output-value",
          "--output requires a path argument.",
        );
      }
      args.output = value;
    } else if (arg?.startsWith("--")) {
      throw new CodaraInvocationError("unknown-flag", `Unknown flag: ${arg}`);
    } else if (arg !== undefined) {
      positionals.push(arg);
    }
  }

  if (positionals[0] === "analyze") {
    args.command = "analyze";
    if (positionals[1]) {
      args.root = positionals[1];
    }
  } else if (positionals.length > 0) {
    args.root = positionals[0]!;
    args.command = "analyze";
  }

  return args;
}

function printHelp(): void {
  console.log(
    [
      "Codara CLI",
      "",
      "Usage:",
      "  codara analyze [root] [--output <path>] [--no-write]",
      "",
      "Options:",
      "  --output <path>   Write the analysis JSON to a custom path (default: .codara/analysis.json)",
      "  --no-write        Do not write output to disk; print the console summary only",
      "  --version         Print the schema and engine versions",
      "  --help            Show this help message",
    ].join("\n"),
  );
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (error instanceof CodaraInvocationError) {
      console.error(`Error: ${error.message}`);
      return 1;
    }
    throw error;
  }

  if (args.help) {
    printHelp();
    return 0;
  }

  if (args.version) {
    console.log(`schemaVersion=${SCHEMA_VERSION} engineVersion=${ENGINE_VERSION}`);
    return 0;
  }

  if (!args.command) {
    printHelp();
    return 1;
  }

  const root = resolve(args.root);

  try {
    const result = await analyzeProject({
      root,
      outputFile: args.output,
    });

    const outputDisplayPath =
      args.output === false ? undefined : (args.output ?? DEFAULT_OUTPUT_FILE);
    console.log(renderSummary(result, root, outputDisplayPath));
    return 0;
  } catch (error) {
    if (error instanceof CodaraInvocationError) {
      console.error(`Error: ${error.message}`);
      return 1;
    }
    console.error("Error: analysis failed unexpectedly.");
    console.error(error);
    return 1;
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
