import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const writeToClientFolder = process.env.EXPORT_TO_CLIENT === "true";
console.log("writeToClientFolder: ", writeToClientFolder, "\n");

const abiPath = "artifacts/contracts/";
const rootPathExport = "./uiExport";
const abiPathExport = writeToClientFolder
  ? "../<client-folder>/src/data/ABI/"
  : "./uiExport/ABI/";
const typechainPathExport = writeToClientFolder
  ? "../<client-folder>/src/types/typechain/"
  : "./uiExport/typechain/";

// { common_name: subpath/?filename }
const targetList: { [key: string]: string } = {};

let abiIndex = "";
let typechainIndex = "";

const main = async () => {
  if (writeToClientFolder) {
    if (!fs.existsSync(abiPathExport) || !fs.existsSync(typechainPathExport))
      throw Error("Client folder not found");
  } else {
    if (!fs.existsSync(rootPathExport)) fs.mkdirSync(rootPathExport);
    if (!fs.existsSync(abiPathExport)) fs.mkdirSync(abiPathExport);
    if (!fs.existsSync(typechainPathExport)) fs.mkdirSync(typechainPathExport);
  }

  Object.entries(targetList).map(async ([name, path]: [string, string]) => {
    const file = path.replace(/^.*[\\/]/, "");
    console.log("file: ", file);

    // ABI

    const abiJson = fs.readFileSync(
      `${abiPath}${path}.sol/${file}.json`,
      "utf8",
    );
    const abi = JSON.parse(abiJson).abi;
    fs.writeFileSync(
      `${abiPathExport}${name}.json`,
      JSON.stringify(abi, null, 2),
    );

    abiIndex += `import ${name}ABI from "./${name}.json";\n`;

    // Typechain

    fs.copyFileSync(
      `./typechain/${file}.d.ts`,
      `${typechainPathExport}${file}.d.ts`,
    );

    typechainIndex += `export { ${file} } from "./${file}";\n`;
  });

  abiIndex += `\nexport {${Object.entries(targetList)
    .map(([name]) => `\n  ${name}ABI`)
    .join(",")}\n};`;

  fs.writeFileSync(`${abiPathExport}index.ts`, abiIndex);
  fs.writeFileSync(`${typechainPathExport}index.ts`, typechainIndex);

  if (writeToClientFolder) {
    console.log("\n=> Files copied to dapp\n");
  } else {
    console.log("\n=> Folders ready at uiExport/\n");
  }
};

main()
  .then(() => process.exit())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
