// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

pragma solidity 0.8.19;

/**
 * @dev Interface of ERC721A.
 */
interface IERC721A {
  function transferFrom(address from, address to, uint256 tokenId) external;
}

contract ContractTransferMock {
  function contractTransfer(
    address collectionAddress,
    address from,
    address to,
    uint256 tokenId
  ) external {
    IERC721A(collectionAddress).transferFrom(from, to, tokenId);
  }
}
