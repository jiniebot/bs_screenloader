import path from "path";
import { createJiniescreenProject } from "../../scripts/create-jiniescreen-project.js";

export async function generateJiniescreenBundle({
  videoPath,
  playerName,
  outputRoot,
  templateDir,
  baseUrl,
}) {
  const outDir = outputRoot
    ? path.join(outputRoot, playerName)
    : path.resolve(process.cwd(), playerName);

  return createJiniescreenProject({
    videoPath,
    playerName,
    outDir,
    templateDir,
    baseUrl,
  });
}
