// SPDX-License-Identifier: UNLICENCED
pragma solidity 0.8.19;

// Interfaces
import { IERC721A } from "./IERC721A.sol";

interface ITickieNFT is IERC721A {
  function minter() external view returns (address);

  function initialize(
    bool canTransfer_,
    bool canTransferFromContracts_,
    string memory collectionName_,
    string memory baseURI_
  ) external;
}
