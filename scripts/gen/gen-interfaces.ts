import fs from "fs";
import { series } from "async";
import { exec } from "child_process";
// import { SolcVersion } from "./helpers/SolcVersionType";
import { License } from "./static/licenceType";
import * as typechain from "../../typechain";
import { JsonFragment, JsonFragmentType } from "@ethersproject/abi";

const typechainContractFactories = typechain.factories;

(async () => {
  await genInterfaces();
})();

export async function genInterfaces(
  contracts: string[] = ["*"],
  licence: License = "MIT",
  solcVersion: string = "0.8.19",
) {
  await series([() => exec("npx hardhat compile")]);
  if (!fs.existsSync("typechain/factories/")) {
    throw Error("Typechain files not found");
  }

  const abiData: {
    name: string;
    abi: JsonFragment[];
  }[] = [];

  for (const file of Object.keys(typechainContractFactories)) {
    if (!file.includes("__factory")) continue;

    const filename = file.slice(0, file.lastIndexOf("__factory"));
    const isInterface =
      filename[0] === "I" && filename[1] === filename[1].toUpperCase();

    if (isInterface) continue;

    if (contracts.includes("*") || contracts.includes(filename)) {
      const abi: JsonFragment[] = (typechainContractFactories as any)[file].abi;

      abiData.push({ name: filename, abi });
      console.log(`=> Found ${filename} ABI`);
    }
  }

  if (!fs.existsSync("contracts/gen_interfaces/")) {
    fs.mkdirSync("contracts/gen_interfaces/");
  }

  console.log(`\n==> Found ${abiData.length} ABI\n`);

  for (const data of abiData) {
    try {
      const interfaceFile: string = writeInterfaceContent(
        data.abi,
        data.name,
        licence,
        solcVersion,
      );

      const outPath = `contracts/gen_interfaces/I${data.name}.sol`;
      fs.writeFileSync(outPath, interfaceFile);

      console.log(`=> Gen I${data.name}.sol`);
    } catch (err: any) {
      console.log(`\u001b[31m=> I${data.name}.sol = ERROR\u001b[0m`);
      // console.log(err);
    }
  }

  await series([() => exec("npx prettier --write contracts/gen_interfaces")]);
  console.log(`\n==> Formated generated interfaces\n`);
}

function writeInterfaceContent(
  abi: JsonFragment[],
  filename: string,
  licence: string,
  solidityVersion: string,
) {
  let output = `// SPDX-License-Identifier: ${licence}
  pragma solidity ^${solidityVersion};
  
  interface I${filename} {
    xxSTRUCTSxx\n`;

  const rawStructures: any[] = [];

  abi.forEach(element => {
    const { methodString, structures } = getMethodInterface(element);
    rawStructures.push(...structures);
    output += methodString;
  });

  const structsDone: any = {};
  if (rawStructures.flat().length) {
    const structTextArray = rawStructures.flat().map((struct: any) => {
      if (structsDone[struct.structName]) {
        return "";
      } else {
        structsDone[struct.structName] = true;

        if (struct.structName.includes("[]")) {
          struct.structName = struct.structName.slice(
            0,
            struct.structName.length - 2,
          );
        }

        return `struct ${struct.structName} {
          ${struct.components
            .map((entry: any) => `  ${entry.type} ${entry.name}`)
            .join(";\n")};
          }\n`;
      }
    });

    output = output.replace("xxSTRUCTSxx", structTextArray.join(" "));
  } else {
    output = output.replace("xxSTRUCTSxx", "");
  }

  return `${output}}`;
}

function getMethodInterface(abiFragment: JsonFragment) {
  const out = [];
  const structsUnflat: any[] = [];
  // Type
  // Interfaces limitation: https://solidity.readthedocs.io/en/v0.4.24/contracts.html#interfaces

  const { type, name, inputs, stateMutability, payable, outputs } = abiFragment;

  if (type === "function" || type === "event" || type === "error") {
    out.push(type + " ");
    // Name
    if (name) {
      out.push(name);
    }
    // Inputs
    out.push("(");
    if (inputs?.length) {
      const [params, structs] = getInOrOut(type, inputs);
      out.push(params);
      structsUnflat.push(structs);
    }
    out.push(") ");

    // In interface is always external
    if (type === "function") out.push("external ");

    // State mutability
    if (stateMutability === "pure") {
      out.push("pure ");
    } else if (stateMutability === "view") {
      out.push("view ");
    }
    // Payable
    if (payable) {
      out.push("payable ");
    }
    // Outputs
    if (outputs && outputs.length > 0) {
      out.push("returns ");
      out.push("(");
      const [params, structs] = getInOrOut(type, outputs);
      out.push(params);
      structsUnflat.push(structs);
      out.push(")");
    }

    const methodString = `${out.join("")};`;
    const structures = structsUnflat.flat();
    return { methodString, structures };
  } else {
    return { methodString: "", structures: [] };
  }
}

function getInOrOut(
  fragType: "function" | "event" | "error",
  inputs: readonly JsonFragmentType[],
) {
  let out = "";
  const structures: any = [];
  for (let i = 0; i < inputs.length; i += 1) {
    const { name, type, internalType, indexed } = inputs[i];

    if (
      (type == "tuple" || type == "tuple[]") &&
      internalType.includes("struct")
    ) {
      const structName = internalType.slice(internalType.indexOf(".") + 1);

      structures.push({ ...inputs[i], structName: structName });

      out += structName;
      if (fragType === "function") out += " memory";
      if (indexed) {
        out += " indexed";
      }
    } else {
      if (type) out += type;

      if (indexed) {
        out += " indexed";
      }
      if (type?.includes("[") || type == "string" || type == "bytes") {
        out += " memory";
      }

      if (name) out += ` ${name}`;
    }

    if (i !== inputs.length - 1) {
      out += ", ";
    }
  }
  return [out, structures];
}
