// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract NewImplementationMock {
  function initialize(bool, bool, string memory, string memory) external {
    // This function is only here so initialization does not fail
  }

  function placeHolderTokenURI() external pure returns (string memory) {
    return "I'm new";
  }
}
