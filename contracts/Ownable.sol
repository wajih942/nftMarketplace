// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 */
abstract contract Ownable {
  address private _owner;

  event OwnershipTransferred(
    address indexed previousOwner,
    address indexed newOwner
  );

  /**
   * @dev Initializes the contract setting the deployer as the initial owner.
   */
  constructor() {
    _owner = msg.sender;
  }

  //======= ERRORS =======//
  //======================//

  error NotOwner();
  error NewOwnerIsZeroAddress();

  //======= MODIFIERS =======//
  //=========================//

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    if (msg.sender != _owner) revert NotOwner();
    _;
  }

  //======= VIEWS =======//
  //=====================//

  /**
   * @dev Returns the address of the current owner.
   */
  function owner() public view virtual returns (address) {
    return _owner;
  }

  //======= ADMIN =======//
  //=====================//

  function _setOwner(address newOwner) internal {
    if (newOwner == address(0)) revert NewOwnerIsZeroAddress();
    _owner = newOwner;
  }

  /**
   * @dev Leaves the contract without owner. It will not be possible to call
   * `onlyOwner` functions anymore. Can only be called by the current owner.
   *
   * NOTE: Renouncing ownership will leave the contract without an owner,
   * thereby removing any functionality that is only available to the owner.
   */
  function renounceOwnership() public virtual onlyOwner {
    _owner = address(0);
  }

  /**
   * @dev Transfers ownership of the contract to a new account (`newOwner`).
   * Can only be called by the current owner.
   */
  function transferOwnership(address newOwner) public virtual onlyOwner {
    address oldOwner = _owner;

    _setOwner(newOwner);

    emit OwnershipTransferred(oldOwner, newOwner);
  }
}
