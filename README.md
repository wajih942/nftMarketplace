# TICKIE SMART-CONTRACTS

**<description>**

## Local Development

The following assumes the use of `node@>=14`.

### Install Dependencies

1.  Copy `.env.example` file and change its name to `.env` in the project folder
2.  Run `npm i` to install all dependencies

### Compile Contracts

`npx hardhat compile`

Note: There will be a new folder called `typechain` generated in your project workspace. You will need to navigate to `typechain/index.ts` and delete duplicated lines inside this file in order to proceed.

### Run Tests with Hardhat

`npx hardhat test <files to test>`

### Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Goerli.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Goerli node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network kovan scripts/sample-script.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network goerli <address> <unlock time>
```

### Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).
