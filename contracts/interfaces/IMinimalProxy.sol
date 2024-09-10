// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IMinimalProxy {
  function refreshImplementation(address newImplementation) external;
}
