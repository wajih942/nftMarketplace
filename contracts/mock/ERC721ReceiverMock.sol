// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IERC721A {
  function safeMint(address to, uint256 quantity) external;
}

contract ERC721ReceiverMock {
  enum Error {
    None,
    RevertWithMessage,
    RevertWithoutMessage,
    Panic
  }

  bytes4 private immutable _retval;
  address private immutable _erc721aMock;

  constructor(bytes4 retval, address erc721aMock) {
    _retval = retval;
    _erc721aMock = erc721aMock;
  }

  error ReceiverRevert();

  event Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes data,
    uint256 gas
  );

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes memory data
  ) public returns (bytes4) {
    uint256 dataValue = data.length == 0 ? 0 : uint256(uint8(data[0]));

    // For testing reverts with a message from the receiver contract.
    if (dataValue == 0x01) {
      revert ReceiverRevert();
    }

    // For testing with the returned wrong value from the receiver contract.
    if (dataValue == 0x02) {
      return 0x0;
    }

    // For testing the reentrancy protection.
    if (dataValue == 0x03) {
      IERC721A(_erc721aMock).safeMint(address(this), 1);
    }

    emit Received(operator, from, tokenId, data, 20000);
    return _retval;
  }
}
