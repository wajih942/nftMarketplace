import hre from "hardhat";
import {
  deployTickieFactoryContract,
  deployTickieNFTContract,
} from "../test/helpers/ProtocolHelper";
import {
  testDeployerSigner,
  liveDeployerSigner,
} from "../test/helpers/HardhatHelper";

// ================ //

async function main() {
  console.log(`\n== DEPLOY ON ${hre.network.name.toUpperCase()} ==\n`);

  const deployer =
    hre.network.name === "hardhat"
      ? await testDeployerSigner()
      : liveDeployerSigner(hre.network.name);

  const implementationContract = await deployTickieNFTContract(deployer);
  console.log("Implementation deployed at:\n", implementationContract.address);

  const nftFactoryContract = await deployTickieFactoryContract(
    deployer,
    implementationContract.address,
  );
  console.log("Factory deployed at:\n", nftFactoryContract.address);

  console.log(`\n== DEPLOY SUCCESS ==\n`);
}

// This pattern enables use of async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
