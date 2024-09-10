// SPDX-License-Identifier: UNLICENCED
pragma solidity 0.8.19;

// Addons
import { Ownable } from "./Ownable.sol";
// Contracts
import { MinimalProxy } from "./MinimalProxy.sol";
// Interfaces
import { ITickieNFT } from "./interfaces/ITickieNFT.sol";
import { ITickieFactory } from "./interfaces/ITickieFactory.sol";
import { IMinimalProxy } from "./interfaces/IMinimalProxy.sol";

/// @title Tickie NFT collection factory
/// @notice Contract factory that deploys minimal proxies for a Tickie NFT implementation contract
contract TickieFactory is ITickieFactory, Ownable {
  //======= STORAGE =======//
  //=======================//
  // The ID of the next collection to be deployed
  uint256 public nextCollectionId;
  // Maps a collection ID to its deployment address
  mapping(uint256 collectionId => address deployedAt) public collections;
  // The address of the current Tickie NFT implementation contract
  address public implementation;
  // Single wallet authorized to deploy new collections
  address public deployer;

  //======= STRUCTS =======//
  //=======================//

  // The structure for queried collection information
  struct CollectionQuery {
    uint256 id;
    string name;
    string symbol;
    address minter;
    uint256 amountTicketsMinted;
    uint256 amountInvitationsMinted;
    uint256 amountBurned;
    address deployedAt;
    string uri;
  }

  //======= CONSTRUCTOR =======//
  //===========================//

  constructor(address implementation_) {
    implementation = implementation_;
  }

  //======= EVENTS =======//
  //======================//

  /// @dev Emitted when a new collection is created
  event CollectionCreated(
    uint256 indexed collectionId,
    address collectionAddress
  );
  /// @dev Emitted when a new implementation contract has been set
  event NewImplementation(address newImplementation);
  /// @dev Emitted when the implementation contract of a collection is refreshed
  event ImplementationRefreshed(
    uint256 indexed collectionId,
    address indexed collectionAddress,
    address indexed newImplementation
  );

  //======= ERRORS =======//
  //======================//

  /// @dev Thrown when an implementation is required
  error NoImplementationSet();
  /// @dev Thrown when querying data for a non existent collection
  error QueryForNonExistentCollection();
  /// @dev Thrown when a non authorized wallet calls a priviledged function
  error NotOwnerOrDeployer();

  //======= MODIFIERS =======//
  //=========================//

  /*
   * @dev Authenticates the caller
   */
  modifier onlyOwnerOrDeployer() {
    if (msg.sender != owner())
      if (msg.sender != deployer) revert NotOwnerOrDeployer();
    _;
  }

  /*
   * @dev Checks if an implementation contract is configured
   */
  modifier hasImplementation() {
    if (implementation == address(0)) revert NoImplementationSet();
    _;
  }

  //======= VIEWS =======//
  //=====================//

  /*
   * @dev Returns the data of a collection
   * @param collectionId The ID of the collection
   */
  function collectionData(
    uint256 collectionId
  ) public view returns (CollectionQuery memory _collectionData) {
    address deployedAt = collections[collectionId];
    if (deployedAt == address(0)) revert QueryForNonExistentCollection();

    // Create an interface to handle queries to the collection
    ITickieNFT collectionInterface = ITickieNFT(deployedAt);

    _collectionData = CollectionQuery({
      id: collectionId,
      name: collectionInterface.name(),
      symbol: collectionInterface.symbol(),
      minter: collectionInterface.minter(),
      amountTicketsMinted: collectionInterface.totalMintedClassic(),
      amountInvitationsMinted: collectionInterface.totalMintedInvitations(),
      amountBurned: collectionInterface.totalBurned(),
      deployedAt: deployedAt,
      uri: collectionInterface.baseURI()
    });
  }

  /*
   * @dev Returns the data of a all collections
   */
  function allCollectionsData()
    external
    view
    returns (CollectionQuery[] memory)
  {
    CollectionQuery[] memory _collectionsData = new CollectionQuery[](
      nextCollectionId
    );

    for (uint256 i; i < nextCollectionId; i++) {
      _collectionsData[i] = collectionData(i);
    }

    return _collectionsData;
  }

  function allCollections() external view returns (address[] memory) {
    address[] memory _collections = new address[](nextCollectionId);
    for (uint256 i; i < nextCollectionId; i++) {
      _collections[i] = collections[i];
    }
    return _collections;
  }

  //======= DEPLOY =======//
  //======================//

  /*
   * @dev Deploys a new collection
   * @param canTransfer_ Whether token transfers are allowed
   * @param canTransferFromContracts_ Whether token transfers initiated by contracts are allowed
   * @param collectionName The name of the collection
   * @param baseURI The base URI of the collection metadata
   */
  function deployCollection(
    bool canTransfer_,
    bool canTransferFromContracts_,
    string memory collectionName,
    string memory baseURI
  ) external hasImplementation onlyOwnerOrDeployer {
    MinimalProxy deployed = new MinimalProxy(
      implementation,
      canTransfer_,
      canTransferFromContracts_,
      collectionName,
      baseURI
    );

    uint256 collectionId = nextCollectionId;
    nextCollectionId++;

    collections[collectionId] = address(deployed);

    emit CollectionCreated(collectionId, address(deployed));
  }

  //======= ADMIN =======//
  //=====================//

  /*
   * @dev Changes the implementation contract use by future collections
   * @param newImplementation The address of the new implementation contract
   */
  function changeImplementation(address newImplementation) external onlyOwner {
    implementation = newImplementation;
    emit NewImplementation(newImplementation);
  }

  /*
   * @dev Refreshes the implementation contract of deployed collections
   * @param collectionIds The IDs of the collections to refresh
   */
  function refreshImplementations(
    uint256[] calldata collectionIds
  ) external hasImplementation onlyOwner {
    for (uint256 i; i < collectionIds.length; i++) {
      uint256 currentId = collectionIds[i];
      address collectionAddress = collections[currentId];

      IMinimalProxy(collectionAddress).refreshImplementation(implementation);

      emit ImplementationRefreshed(
        currentId,
        collectionAddress,
        implementation
      );
    }
  }

  /*
   * @dev Sets an authorized deployer wallet address
   * @param newDeployer The address of the new deployer
   */
  function changeDeployer(address newDeployer) external onlyOwner {
    deployer = newDeployer;
  }
}
