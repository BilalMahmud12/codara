import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { CodaraAnalysisResult } from "../model/analysis-result.js";

export async function writeAnalysisJson(
  rootPath: string,
  outputFile: string,
  result: CodaraAnalysisResult,
): Promise<string> {
  const absoluteOutputPath = isAbsolute(outputFile) ? outputFile : join(rootPath, outputFile);
  await mkdir(dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return absoluteOutputPath;
}
