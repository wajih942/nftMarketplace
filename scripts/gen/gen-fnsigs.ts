import fs from "fs";
import { ethers } from "ethers";

import { interfaces } from "../../typechain";

const toHash = (func: string) =>
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(func));

const genFnSigs = async () => {
  const fns = Object.values(interfaces)
    .map(factory =>
      Object.keys(typechain.interfaces.createInterface().functions),
    )
    .flat();

  let sigs: any = fns.reduce(
    (acc, func) => ({
      ...acc,
      [func]: toHash(func).slice(0, 10),
    }),
    {},
  );

  fs.writeFileSync(
    "./tests/registries/signatureHashes.json",
    JSON.stringify(sigs, null, 2),
  );

  console.log(
    `\n=> Generated ${fns.length} signatures in tests/registries/signatureHashes.json\n`,
  );
};

genFnSigs();
