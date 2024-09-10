// SPDX-License-Identifier: UNLICENCED
pragma solidity 0.8.19;

// Addons
import { Ownable } from "./Ownable.sol";
// Parent Contracts
import { ERC721A } from "./ERC721A.sol";
import { ERC721Enumerable } from "./ERC721Enumerable.sol";
import { ERC2612Permit } from "./ERC2612Permit.sol";
import { ERC721Royalty } from "./ERC721Royalty.sol";
import { OnlyDelegateCall } from "./OnlyDelegateCall.sol";
// Interfaces
import { ITickieNFT } from "./interfaces/ITickieNFT.sol";
import { IERC165 } from "./interfaces/IERC165.sol";
import { IERC721A } from "./interfaces/IERC721A.sol";

/// @title Tickie NFT collection contract
/// @notice This contract serves as an implementation for the Tickie NFT factory contract
contract TickieNFT is
  ITickieNFT,
  Ownable,
  ERC721Enumerable,
  ERC2612Permit,
  ERC721Royalty,
  OnlyDelegateCall
{
  //======= STORAGE =======//
  //=======================//
  // Single wallet authorized to mint tickets
  address public minter;
  // Whether ticket transfers are currently allowed
  bool public canTransfer;
  // Whether ticket transfers initiated by contracts are currently allowed
  bool public canTransferFromContracts;
  // Token URI used a placeholder before the collection reveal
  string public placeHolderTokenURI;
  // The timestamp from which the placeholder URI will be ignored
  uint256 public revealTimestamp;
  // Hash of the collection metadata authenticating the token ordering
  bytes32 public originHash;
  // Saves initialization state of the collection
  bool public isInitialized;

  //======= INITIALIZE =======//
  //==========================//

  /*
   * @dev Configures the collection when it is initialized by the proxy
   * @param canTransfer_ Whether ticket transfers are currently allowed
   * @param canTransferFromContracts_ Whether ticket transfers initiated by contracts are currently allowed
   * @param collectionName_ The name of the collection
   * @param baseURI_ The base URI of the collection
   *
   * We want to block direct initialization with `onlyDelegateCall` to prevent implementation takeover
   *
   */
  function initialize(
    bool canTransfer_,
    bool canTransferFromContracts_,
    string memory collectionName_,
    string memory baseURI_
  ) external onlyDelegateCall {
    if (isInitialized) revert ContractAlreadyInitialized();
    isInitialized = true;

    canTransfer = canTransfer_;
    canTransferFromContracts = canTransferFromContracts_;

    // We want the wallet calling the factory to be the owner
    // Safe since only the deployer wallet calling the factory can be tx.origin
    Ownable._setOwner(tx.origin);

    ERC721A._initializeERC721A(collectionName_, baseURI_);
    ERC2612Permit._initializeERC721Permit(collectionName_);
  }

  //======= EVENTS =======//
  //======================//

  /// @dev Emitted when the origin hash has been set
  event OriginHashSet(bytes32 originHash);
  /// @dev Emitted when a minter wallet is set
  event MinterUpdated(address indexed oldMinter, address indexed newMinter);
  /// @dev Emitted when transfer authorizations are changes
  event TransferAuthorisationsUpdated(bool fromWallet, bool fromContract);

  //======= ERRORS =======//
  //======================//

  /// @dev Throws when trying to initialize the contract again
  error ContractAlreadyInitialized();
  /// @dev Thrown when a non authorized wallet calls a priviledged function
  error NotOwnerOrMinter();
  /// @dev Thrown when the signature fails or does not resolve to token owner
  error InvalidPermit();
  /// @dev Thrown when the length of arguments do not correspond
  error ArgumentLengthMismatch();
  /// @dev Thrown when trying to transfer while it is not authorized
  error TransfersCurrentlyUnauthorized();
  /// @dev Thrown when trying to transfer from a contract while it is not authorized
  error ContractTransfersCurrentlyUnauthorized();
  /// @dev Thrown when the origin hash is already set
  error OriginHashIsAlreadySet();
  /// @dev Thrown when trying to configure impossible transfer authorizations
  error CannotAllowTransferFromContractsOnly();

  //======= MODIFIERS =======//
  //=========================//

  /*
   * @dev Authenticates the caller
   */
  modifier onlyOwnerOrMinter() {
    if (msg.sender != owner())
      if (msg.sender != minter) revert NotOwnerOrMinter();
    _;
  }

  /*
   * @dev Allows transfer dependant actions to be performed when transfer are not allowed
   */
  modifier authorizationPassthrough() {
    if (!canTransfer) {
      canTransfer = true;
      _;
      canTransfer = false;
    } else {
      _;
    }
  }

  //======= VIEWS =======//
  //=====================//

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view override(ERC721Enumerable, ERC721Royalty) returns (bool) {
    // ERC721Enumerable calls ERC721A 'supportsInterface' through 'super'
    return
      ERC721Enumerable.supportsInterface(interfaceId) ||
      ERC721Royalty.supportsInterface(interfaceId);
  }

  //======= OVERRIDES =======//
  //=========================//

  /*
   * @dev Overrides the ERC721Enumerable hook to check if transfers are currently allowed
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId
  ) internal override(ERC721Enumerable) {
    if (!canTransferFromContracts && msg.sender != tx.origin)
      revert ContractTransfersCurrentlyUnauthorized();
    if (!canTransfer) revert TransfersCurrentlyUnauthorized();

    super._beforeTokenTransfer(from, to, tokenId);
  }

  /*
   * @dev Overrides the ERC721A function to display the placeholder URI
   */
  function tokenURI(
    uint256 tokenId
  ) public view override(ERC721A, IERC721A) returns (string memory) {
    if (bytes(placeHolderTokenURI).length != 0)
      if (block.timestamp < revealTimestamp)
        if (ERC721A.exists(tokenId)) return placeHolderTokenURI;

    return ERC721A.tokenURI(tokenId);
  }

  //======= MINT =======//
  //====================//

  /*
   * @dev Mints tickets to a single recipient
   * @param to The address to mint the ticket to
   * @param quantity The quantity of tickets to mint
   */
  function mintTickets(
    address to,
    uint256 quantity
  ) external onlyOwnerOrMinter authorizationPassthrough {
    ERC721A._mint(to, ERC721A.getStartIndex(), quantity);
  }

  /*
   * @dev Mints tickets to multiple recipients
   * @param to The address to mint the ticket to
   * @param quantity The quantity of tickets to mint
   */
  function mintMulti(
    address[] memory to,
    uint256[] memory quantity
  ) external onlyOwnerOrMinter authorizationPassthrough {
    if (to.length != quantity.length) revert ArgumentLengthMismatch();

    for (uint256 i; i < to.length; i++) {
      ERC721A._mint(to[i], ERC721A.getStartIndex(), quantity[i]);
    }
  }

  /*
   * @dev Mints invitation tickets to a single recipient
   * @param to The address to mint the ticket to
   * @param quantity The quantity of tickets to mint
   */
  function mintInvitationTicket(
    address to,
    uint256 quantity
  ) external onlyOwnerOrMinter authorizationPassthrough {
    ERC721A._mint(to, ERC721A.getStartIndexInvitations(), quantity);
  }

  //======= TOKEN MANAGEMENT =======//
  //================================//

  /*
   * @dev Destroys tickets
   * @param tokenIds The ids of the tickets to burn
   */
  function refundTickets(
    uint256[] calldata tokenIds
  ) external onlyOwnerOrMinter authorizationPassthrough {
    for (uint256 i; i < tokenIds.length; i++) {
      ERC721A._burn(tokenIds[i], false);
    }
  }

  /*
   * @dev Retransfer tickets to a single recipient
   * @param tokenIds The ids of the tickets to transfer
   * @param to The address to transfer the tickets to
   */
  function saveTickets(
    uint256[] calldata tokenIds,
    address to
  ) external onlyOwnerOrMinter authorizationPassthrough {
    for (uint256 i; i < tokenIds.length; i++) {
      ERC721A._approve(address(this), tokenIds[i]);
      address owner = ERC721A.ownerOf(tokenIds[i]);
      ERC721A._transferFrom(owner, to, tokenIds[i]);
    }
  }

  //======= PERMIT =======//
  //======================//

  /*
   * @dev Allow sponsored transfers of tickets using a permit signature
   * @param from The address to transfer the tickets from
   * @param to The address to transfer the tickets to
   * @param spender The collection proxy address handling the transfer
   * @param tokenId The id of the ticket to transfer
   * @param deadline The deadline timestamp of the permit
   * @param v The v value of the permit signature
   * @param r The r value of the permit signature
   * @param s The s value of the permit signature
   */
  function transferFromWithPermit(
    address from,
    address to,
    uint256 tokenId,
    address spender,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    bool isValid = ERC2612Permit._isValidPermit(
      from,
      spender,
      tokenId,
      deadline,
      v,
      r,
      s
    );

    if (!isValid) revert InvalidPermit();
    ERC721A._approve(spender, tokenId);
    ERC721A._transferFrom(from, to, tokenId);
  }

  //======= REVEAL =======//
  //======================//

  /*
   * @dev Sets a placeholder URI for metadata to display before a reveal
   * @param placeHolderTokenURI_ The metadata URI
   * @param revealTimestamp_ The timestamp of the reveal
   *
   * @note Setting a very high value for the reveal timestamp allows for manual reveal timing
   *
   */
  function setPlaceholderURI(
    string memory placeHolderTokenURI_,
    uint256 revealTimestamp_
  ) external onlyOwner {
    placeHolderTokenURI = placeHolderTokenURI_;
    revealTimestamp = revealTimestamp_;
  }

  //======= ORIGIN HASH =======//
  //===========================//

  /*
   * Set the hash of the collection metadata to authenticate the token sequence
   * @param originHash_ The hash of the collection metadata
   */
  function setOriginHash(bytes32 originHash_) external onlyOwner {
    if (originHash != 0x0) revert OriginHashIsAlreadySet();

    originHash = originHash_;
    emit OriginHashSet(originHash_);
  }

  //======= ROYALTY =======//
  //=======================//

  /*
   * @dev Sets the royalty config for the collection
   * @param royaltyReceiver_ The address to receive royalties
   * @param royaltyFee_ The fee to be paid as a percentage of the sale price
   */
  function setRoyaltyConfig(
    address royaltyReceiver_,
    uint96 royaltyFee_
  ) external onlyOwner {
    ERC721Royalty._setDefaultRoyalty(royaltyReceiver_, royaltyFee_);
  }

  //======= ADMIN =======//
  //=====================//

  /*
   * @dev Sets the transfer authorisations for the collection
   * @param fromWallet Whether transfers from wallets are allowed
   * @param fromContract_ Whether transfers from contracts are allowed
   */
  function setTransferAuthorisation(
    bool fromWallet,
    bool fromContract
  ) external onlyOwner {
    if (!fromWallet && fromContract)
      revert CannotAllowTransferFromContractsOnly();

    canTransfer = fromWallet;
    canTransferFromContracts = fromContract;

    emit TransferAuthorisationsUpdated(fromWallet, fromContract);
  }

  /*
   * @dev Sets a wallet with minting privileges
   * @param minter_ The address of the minter
   */
  function setMinter(address minter_) external onlyOwner {
    address oldMinter = minter;
    minter = minter_;

    emit MinterUpdated(oldMinter, minter_);
  }

  /**
   * @dev Sets the base Uniform Resource Identifier (URI) for the collection
   * @param baseURI_ The base URI to be used for the collection
   */
  function setBaseURI(string memory baseURI_) external onlyOwner {
    ERC721A._setBaseURI(baseURI_);
  }
}
