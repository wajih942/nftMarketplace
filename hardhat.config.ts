import dotenv from "dotenv";
import { ethers } from "ethers";
import { HardhatUserConfig } from "hardhat/config";
import { HardhatNetworkUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

const polygonForkConfig: HardhatNetworkUserConfig = {
  forking: {
    url: process.env.POLYGON_URL || "",
    blockNumber: !process.env.FORKING_BLOCK
      ? undefined
      : Number(process.env.FORKING_BLOCK),
  },
  mining: {
    auto: true,
  },
  accounts: {
    count: 20,
  },
};

const mumbaiForkConfig: HardhatNetworkUserConfig = {
  forking: {
    url: process.env.MUMBAI_URL || "",
    // Fixed to take advantage of the cache
    blockNumber: !process.env.FORKING_BLOCK
      ? undefined
      : Number(process.env.FORKING_BLOCK),
  },
  mining: {
    auto: true,
  },
  accounts: [
    // Deployer
    {
      privateKey: process.env.TESTING_PK as string,
      balance: ethers.utils.parseEther("1000").toString(),
    },
    ...Array(20)
      .fill("")
      .map((_, i) => ({
        privateKey: ethers.utils.id(`Test User ${i}`),
        balance: ethers.utils.parseEther("1000").toString(),
      })),
  ],
};

const chooseForkConfig = () => {
  if (process.env.HARDHAT_FORK_TARGET?.toLowerCase() === "polygon") {
    return polygonForkConfig;
  } else if (process.env.HARDHAT_FORK_TARGET?.toLowerCase() === "mumbai") {
    return mumbaiForkConfig;
  }
  throw Error("Invalid fork target");
};

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },

  // ====== Networks ====== //

  networks: {
    hardhat: { allowUnlimitedContractSize: false, ...chooseForkConfig() },
    polygon: {
      url: process.env.POLYGON_URL || "",
      accounts:
        process.env.DEPLOYER_PK !== undefined ? [process.env.DEPLOYER_PK] : [],
    },
    mumbai: {
      url: process.env.MUMBAI_URL || "",
      accounts:
        process.env.DEPLOYER_PK !== undefined ? [process.env.DEPLOYER_PK] : [],
    },
  },

  // ====== Gas Reporter ====== //

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    token: "MATIC",
    gasPriceApi:
      "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
  },

  // ====== Etherscan ====== //

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY ? process.env.ETHERSCAN_API_KEY : "",
    customChains: [
      {
        network: "Polygon",
        chainId: 137,
        urls: {
          apiURL: "https://rpc-mainnet.maticvigil.com/",
          browserURL: "https://polygonscan.com/",
        },
      },
      {
        network: "Mumbai",
        chainId: 80001,
        urls: {
          apiURL: "https://rpc-mumbai.maticvigil.com/",
          browserURL: "https://mumbai.polygonscan.com/",
        },
      },
    ],
  },

  // ====== Typechain ====== //

  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    externalArtifacts: ["externalArtifacts/*.json"], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
    dontOverrideCompile: false, // defaults to false
  },
};

export default config;
