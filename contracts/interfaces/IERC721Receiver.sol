// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/**
 * @dev Interface of ERC721 token receiver.
 */
interface IERC721Receiver {
  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external returns (bytes4);
}
