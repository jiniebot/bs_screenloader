import path from "path";
import { createBrightsignProject } from "../../scripts/create-brightsign-project.js";

export async function generateBrightsignBundle({
  videoPath,
  playerName,
  outputRoot,
  templateDir,
  baseUrl,
}) {
  const outDir = outputRoot
    ? path.join(outputRoot, playerName)
    : path.resolve(process.cwd(), playerName);

  return createBrightsignProject({
    videoPath,
    playerName,
    outDir,
    templateDir,
    baseUrl,
  });
}
