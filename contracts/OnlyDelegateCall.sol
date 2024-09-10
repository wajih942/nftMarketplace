// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Prevents direct call to a contract
/// @notice Base contract that provides a modifier for preventing direct call to methods in a child contract
abstract contract OnlyDelegateCall {
  error OnlyDelegateCallAllowed();

  /// @dev The original address of this contract
  address private immutable original;

  constructor() {
    // Immutables are computed in the init code of the contract, and then inlined into the deployed bytecode.
    // In other words, this variable won't change when it's checked at runtime.
    original = address(this);
  }

  /// @dev Private method is used instead of inlining into modifier because modifiers are copied into each method,
  ///     and the use of immutable means the address bytes are copied in every place the modifier is used.
  function checkDelegateCall() private view {
    if (address(this) == original) revert OnlyDelegateCallAllowed();
  }

  /// @notice Prevents direct call into the modified method
  modifier onlyDelegateCall() {
    checkDelegateCall();
    _;
  }
}
