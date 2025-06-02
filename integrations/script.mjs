import { rm, mkdir, copyFile, readdir, readFile, writeFile } from "fs/promises";
import path from "path";

const INTEGRATIONS_DIR = "deployment/integrations";
const LIST_FILE = "list.json"
async function main() {
  // 1. Create deployment/integrations/
  await rm(INTEGRATIONS_DIR, { recursive: true, force: true });
  await mkdir(INTEGRATIONS_DIR, { recursive: true });

  // 2. Copy list.json to deployment/integrations/
  await copyFile(LIST_FILE, path.join(INTEGRATIONS_DIR, LIST_FILE));

  // 3. Read current directory contents
  const entriesFile =  await readFile(LIST_FILE, "utf-8");
  const entries = JSON.parse(entriesFile);
  const args = process.argv.slice(2);

  for (const entry of entries) {
    if(args.length && !args.includes(entry.folder)){
       continue
    }
   
    const folderName = entry.folder;
    const folderPath = entry.group
      ? `./${entry.group}/${entry.folder}`
      : `./${folderName}`;
    const targetFolder = entry.group
      ? path.join(INTEGRATIONS_DIR, entry.group, folderName)
      : path.join(INTEGRATIONS_DIR, folderName);

    // Create target integration subfolder
    await mkdir(targetFolder, { recursive: true });

    if (!entry.group) {
      // Copy PNG images from source folder to target folder
      const filesInFolder = await readdir(folderPath);

      // Copy all .png files
      const pngFiles = filesInFolder.filter((f) => {
        const value = f.toLowerCase();
        return value.endsWith(".png") || value.endsWith(".svg");
      });
      for (const img of pngFiles) {
        await copyFile(
          path.join(folderPath, img),
          path.join(targetFolder, img)
        );
      }
    }
    if (entry.isGroup) {
      continue;
    }

    // Read and parse schema.json and examples.json
    const schemaPath = path.join(folderPath, "schema.json");
    const examplesPath = path.join(folderPath, "examples.json");

    let schemaJson;
    let examplesJson;

    try {
      const schemaText = await readFile(schemaPath, "utf-8");
      schemaJson = JSON.parse(schemaText);

      const examplesText = await readFile(examplesPath, "utf-8");
      examplesJson = JSON.parse(examplesText);
    } catch (err) {
      console.error(
        `Failed to read or parse JSON files in folder ${folderName}:`,
        err
      );
      continue; // skip this folder if error
    }

    // Create filtered schema.json (only name and description)
    const nodes = schemaJson.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      tags: node.schema.tags,
      method: node.schema?.input?.properties?.method?.const || "undefined",
    }));

    await writeFile(
      path.join(targetFolder, "schema.json"),
      JSON.stringify({ ...schemaJson, nodes }),
      "utf-8"
    );

    // For each node, create {node.id}.json with schema and example
    for (const node of schemaJson.nodes) {
      const nodeSchema = node.schema;
      const nodeExample = examplesJson[node.id] || null;

      const content = {
        schema: nodeSchema,
        examples: nodeExample,
      };

      await writeFile(
        path.join(targetFolder, node.id || ""),
        JSON.stringify(content, null, 2),
        "utf-8"
      );
    }
  }

  console.log("Deployment structure created successfully!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
