import { providers, Wallet, Signature } from "ethers";
import hre, { ethers, network } from "hardhat";
import { HardhatNetworkConfig } from "hardhat/types";
import { TickieNFT } from "../../typechain";

export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function testDeployerSigner() {
  return (await ethers.getSigners())[0];
}

export function liveDeployerSigner(chainName?: string) {
  // Backs up on specified RPC urls
  const rpcUrl =
    process.env.DEPLOYMENT_RPC_URL ||
    process.env[`${chainName?.toUpperCase()}_URL`];

  if (!process.env.DEPLOYER_PK || !rpcUrl) {
    throw Error("Missing PK and/or RPC URL");
  }

  return new ethers.Wallet(
    process.env.DEPLOYER_PK as string,
    new providers.JsonRpcProvider(rpcUrl),
  );
}

export async function resetFork() {
  const originalFork = (network.config as HardhatNetworkConfig).forking?.url;
  const forkTarget = originalFork || process.env.GOERLI_URL;

  const originalForkBlock = (network.config as HardhatNetworkConfig).forking
    ?.blockNumber;
  const forkTargetBlock =
    originalForkBlock || Number(process.env.FORKING_BLOCK || "latest");

  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: forkTarget,
          blockNumber: forkTargetBlock,
        },
      },
    ],
  });
}

export async function impersonateWallet(account: string) {
  return (await hre.ethers.getImpersonatedSigner(account)) as any as Wallet;
}

export async function getLatestBlockTimestamp(): Promise<number> {
  return (await ethers.provider.getBlock("latest"))?.timestamp || 0;
}

export async function setNextBlockTimestamp(addingTime: number) {
  if (addingTime <= 0) return;
  const latestTimeStamp = (await hre.ethers.provider.getBlock("latest"))
    .timestamp;

  const newTime = latestTimeStamp + addingTime;

  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [newTime],
  });
  await hre.network.provider.request({ method: "evm_mine" });
}

export async function getCurrentTime() {
  return (await hre.ethers.provider.getBlock("latest")).timestamp;
}

export async function getCustomError(txPromise: Promise<any>): Promise<string> {
  try {
    await txPromise;
    throw Error("Transaction did not throw");
  } catch (err: any) {
    if (err.errorName) {
      return err.errorName;
    }
    if (err.reason?.includes("reverted with custom error")) {
      return err.reason.slice(
        err.reason.indexOf("reverted with custom error") + 28,
        err.reason.length - 3,
      );
    }

    throw Error(`Transaction did not revert with custom error: ${err}`);
  }
}

export async function getTickiePermitSignature(
  signer: Wallet,
  tokenId: number,
  spender: string,
  tokenContract: TickieNFT,
  deadline: number,
): Promise<Signature> {
  const [nonce, name, version, chainId] = await Promise.all([
    tokenContract.nonces(signer.address),
    tokenContract.name(),
    "1",
    tokenContract.getChainId(),
  ]);

  return ethers.utils.splitSignature(
    await signer._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: tokenContract.address,
      },
      {
        Permit: [
          {
            name: "owner",
            type: "address",
          },
          {
            name: "spender",
            type: "address",
          },
          {
            name: "tokenId",
            type: "uint256",
          },
          {
            name: "nonce",
            type: "uint256",
          },
          {
            name: "deadline",
            type: "uint256",
          },
        ],
      },
      {
        owner: signer.address,
        spender,
        tokenId,
        nonce,
        deadline,
      },
    ),
  );
}
