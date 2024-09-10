import { ethers } from "ethers";
import { contractFactory } from "./TypedContracts";

export async function deployTickieNFTContract(owner: ethers.Signer) {
  return await (await contractFactory.TickieNFT(owner).deploy()).deployed();
}

export async function deployERC721ReceiverMock(
  owner: ethers.Signer,
  retva: string,
  nftImplementation: string,
) {
  return await (
    await contractFactory
      .ERC721ReceiverMock(owner)
      .deploy(retva, nftImplementation)
  ).deployed();
}

export async function deployTickieFactoryContract(
  owner: ethers.Signer,
  nftImplementation: string,
) {
  return await (
    await contractFactory.TickieFactory(owner).deploy(nftImplementation)
  ).deployed();
}

export async function deployNewImplementationMockContract(
  owner: ethers.Signer,
) {
  return await (
    await contractFactory.NewImplementationMock(owner).deploy()
  ).deployed();
}

export async function deployContractTransferMockContract(owner: ethers.Signer) {
  return await (
    await contractFactory.ContractTransferMock(owner).deploy()
  ).deployed();
}
