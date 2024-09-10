import { ethers } from "ethers";
// typechain
import {
  ContractTransferMock,
  ContractTransferMock__factory,
  ERC721A,
  ERC721A__factory,
  ERC721ReceiverMock,
  ERC721ReceiverMock__factory,
  MinimalProxy,
  MinimalProxy__factory,
  NewImplementationMock,
  NewImplementationMock__factory,
  TickieFactory,
  TickieFactory__factory,
  TickieNFT,
  TickieNFT__factory,
} from "../../typechain";

export type ProtocolContract =
  | "TickieFactory"
  | "MinimalProxy"
  | "TickieNFT"
  | "NewImplementationMock"
  | "ContractTransferMock"
  | "ERC721ReceiverMock";

export const contractFactory = {
  TickieFactory: (signer: ethers.Signer) => new TickieFactory__factory(signer),
  MinimalProxy: (signer: ethers.Signer) => new MinimalProxy__factory(signer),
  TickieNFT: (signer: ethers.Signer) => new TickieNFT__factory(signer),
  ERC721A: (signer: ethers.Signer) => new ERC721A__factory(signer),
  ERC721ReceiverMock: (signer: ethers.Signer) =>
    new ERC721ReceiverMock__factory(signer),
  NewImplementationMock: (signer: ethers.Signer) =>
    new NewImplementationMock__factory(signer),
  ContractTransferMock: (signer: ethers.Signer) =>
    new ContractTransferMock__factory(signer),
};

export const typedContract = {
  TickieFactory: (address: string) =>
    new ethers.Contract(address, TickieFactory__factory.abi) as TickieFactory,
  MinimalProxy: (address: string) =>
    new ethers.Contract(address, MinimalProxy__factory.abi) as MinimalProxy,
  TickieNFT: (address: string) =>
    new ethers.Contract(address, TickieNFT__factory.abi) as TickieNFT,
  ERC721ReceiverMock: (address: string) =>
    new ethers.Contract(
      address,
      ERC721ReceiverMock__factory.abi,
    ) as ERC721ReceiverMock,
  ERC721A: (address: string) =>
    new ethers.Contract(address, ERC721A__factory.abi) as ERC721A,
  NewImplementationMock: (address: string) =>
    new ethers.Contract(
      address,
      NewImplementationMock__factory.abi,
    ) as NewImplementationMock,
  ContractTransferMock: (address: string) =>
    new ethers.Contract(
      address,
      ContractTransferMock__factory.abi,
    ) as ContractTransferMock,
};
