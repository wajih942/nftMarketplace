// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// Addons
import { Ownable } from "./Ownable.sol";
// Interfaces
import { IERC721A } from "./interfaces/IERC721A.sol";
import { IERC721Receiver } from "./interfaces/IERC721Receiver.sol";

/**
 * @title ERC721A
 *
 * @dev Implementation of the [ERC721](https://eips.ethereum.org/EIPS/eip-721)
 * Non-Fungible Token Standard, including the Metadata extension.
 * Optimized for lower gas during batch mints.
 *
 * Token IDs are minted in sequential order (e.g. 0, 1, 2, 3, ...)
 *
 * Assumptions:
 *
 * - An owner cannot have more than 2**64 - 1 (max value of uint64) of supply.
 * - The maximum token ID cannot exceed 2**256 - 1 (max value of uint256).
 */
contract ERC721A is IERC721A, Ownable {
  // =============================================================
  //                           CONSTANTS
  // =============================================================

  // The bit position of `startTimestamp` in packed ownership.
  uint256 private constant _BITPOS_START_TIMESTAMP = 160;

  // The bit mask of the `burned` bit in packed ownership.
  uint256 private constant _BITMASK_BURNED = 1 << 224;

  // The bit position of the `nextInitialized` bit in packed ownership.
  uint256 private constant _BITPOS_NEXT_INITIALIZED = 225;

  // The bit mask of the `nextInitialized` bit in packed ownership.
  uint256 private constant _BITMASK_NEXT_INITIALIZED = 1 << 225;

  // The bit position of `extraData` in packed ownership.
  uint256 private constant _BITPOS_EXTRA_DATA = 232;

  // The mask of the lower 160 bits for addresses.
  uint256 private constant _BITMASK_ADDRESS = (1 << 160) - 1;

  // The `Transfer` event signature is given by:
  // `keccak256(bytes("Transfer(address,address,uint256)"))`.
  bytes32 private constant _TRANSFER_EVENT_SIGNATURE =
    0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

  uint256 internal constant _INVITATION_START_INDEX = 1_000_000;

  // =============================================================
  //                            STORAGE
  // =============================================================

  // The total amount of tokens minted in the contract and next token ID to be minted.
  uint256 public totalMintedClassic;

  // The total amount of tokens minted in the contract and next token ID to be minted.
  uint256 public totalMintedInvitations;

  // The number of tokens burned.
  uint256 public totalBurned;

  // Token name
  string public name;

  // Token symbol
  string public symbol;

  // Token URL path or base
  /// @dev Private since the URI can be a path with base in the factory
  string internal _baseURI;

  // Mapping from token ID to ownership details
  // An empty struct value does not necessarily mean the token is unowned.
  // See {_packedOwnershipOf} implementation for details.
  //
  // Bits Layout:
  // - [0..159]   `addr`
  // - [160..223] `startTimestamp`
  // - [224]      `burned`
  // - [225]      `nextInitialized`
  // - [232..255] `extraData`
  mapping(uint256 => uint256) private _packedOwnerships;

  // Mapping owner address to balance.
  mapping(address => uint256) private _balances;

  // Mapping from token ID to approved address.
  mapping(uint256 => address) private _tokenApprovals;

  // Mapping from owner to operator approvals
  mapping(address => mapping(address => bool)) private _operatorApprovals;

  // =============================================================
  //                         INITIALIZATION
  // =============================================================

  function _initializeERC721A(
    string memory name_,
    string memory baseURI_
  ) internal {
    name = name_;
    symbol = "TICKIE NFT";
    _baseURI = baseURI_;
  }

  // =============================================================
  //                            ERRORS
  // =============================================================

  /// @dev The caller must own the token or be an approved operator.
  error ApprovalCallerNotOwnerNorApproved();
  /// @dev The token does not exist.
  error ApprovalQueryForNonexistentToken();
  /// @dev Cannot mint to the zero address.
  error MintToZeroAddress();
  /// @dev The quantity of tokens minted must be more than zero.
  error MintZeroQuantity();
  /// @dev The token does not exist.
  error OwnerQueryForNonexistentToken();
  /// @dev The caller must own the token or be an approved operator.
  error TransferCallerNotOwnerNorApproved();
  /// @dev The token must be owned by `from`.
  error TransferFromIncorrectOwner();
  /// @dev Cannot safely transfer to a contract that does not implement the  ERC721Receiver interface.
  error TransferToNonERC721ReceiverImplementer();
  /// @dev ERC721 Receiver returned an invalid response.
  error ReceiverRevert();
  /// @dev Cannot transfer to the zero address.
  error TransferToZeroAddress();
  /// @dev The token does not exist.
  error URIQueryForNonexistentToken();

  // =============================================================
  //                            EVENTS
  // =============================================================

  /**
   * @dev Emitted when `tokenId` token is transferred from `from` to `to`.
   */
  event Transfer(
    address indexed from,
    address indexed to,
    uint256 indexed tokenId
  );

  /**
   * @dev Emitted when `owner` enables `approved` to manage the `tokenId` token.
   */
  event Approval(
    address indexed owner,
    address indexed approved,
    uint256 indexed tokenId
  );

  /**
   * @dev Emitted when `owner` enables or disables
   * (`approved`) `operator` to manage all of its assets.
   */
  event ApprovalForAll(
    address indexed owner,
    address indexed operator,
    bool approved
  );

  // =============================================================
  //                   TOKEN COUNTING OPERATIONS
  // =============================================================

  function totalMinted() public view returns (uint256) {
    // Counter overflow is near impossible
    unchecked {
      return totalMintedClassic + totalMintedInvitations;
    }
  }

  function getStartIndex() public view returns (uint256) {
    return totalMintedClassic;
  }

  function getStartIndexInvitations() public view returns (uint256) {
    return totalMintedInvitations + _INVITATION_START_INDEX;
  }

  // =============================================================
  //                    ADDRESS DATA OPERATIONS
  // =============================================================

  /**
   * @dev Returns the number of tokens in `owner`'s account.
   */
  function balanceOf(address owner) public view returns (uint256) {
    return _balances[owner];
  }

  // =============================================================
  //                            IERC165
  // =============================================================

  /**
   * @dev Returns true if this contract implements the interface defined by
   * `interfaceId`. See the corresponding
   * [EIP section](https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified)
   * to learn more about how these ids are created.
   *
   * This function call must use less than 30000 gas.
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual returns (bool) {
    // The interface IDs are constants representing the first 4 bytes
    // of the XOR of all function selectors in the interface.
    // See: [ERC165](https://eips.ethereum.org/EIPS/eip-165)
    // (e.g. `bytes4(i.functionA.selector ^ i.functionB.selector ^ ...)`)
    return
      interfaceId == 0x01ffc9a7 || // ERC165 interface ID for ERC165.
      interfaceId == 0x80ac58cd || // ERC165 interface ID for ERC721.
      interfaceId == 0x5b5e139f; // ERC165 interface ID for ERC721Metadata.
  }

  // =============================================================
  //                        IERC721Metadata
  // =============================================================

  /**
   * @dev Sets the Uniform Resource Identifier (URI) for the collection.
   */
  function _setBaseURI(string memory baseURI_) internal virtual {
    _baseURI = baseURI_;
  }

  /**
   * @dev Returns the base Uniform Resource Identifier (URI) for the collection.
   */
  function baseURI() external view returns (string memory) {
    return _baseURI;
  }

  /**
   * @dev Returns the Uniform Resource Identifier (URI) for `tokenId` token.
   * Base URI is kept in factory to avoid multiple collection updates
   */
  function tokenURI(
    uint256 tokenId
  ) public view virtual returns (string memory) {
    if (!exists(tokenId)) revert URIQueryForNonexistentToken();

    return string(abi.encodePacked(_baseURI, _toString(tokenId)));
  }

  // =============================================================
  //                     OWNERSHIPS OPERATIONS
  // =============================================================

  /**
   * @dev Returns the owner of the `tokenId` token.
   *
   * Requirements:
   *
   * - `tokenId` must exist.
   */
  function ownerOf(uint256 tokenId) public view returns (address) {
    return address(uint160(_packedOwnershipOf(tokenId)));
  }

  /**
   * Returns the packed ownership data of `tokenId`.
   */
  function _packedOwnershipOf(uint256 tokenId) private view returns (uint256) {
    uint256 curr = tokenId;

    unchecked {
      if (
        tokenId < getStartIndex() ||
        (
          (_INVITATION_START_INDEX <= tokenId &&
            tokenId < getStartIndexInvitations())
        )
      ) {
        uint256 packed = _packedOwnerships[curr];
        // If not burned.
        if (packed & _BITMASK_BURNED == 0) {
          // Invariant:
          // There will always be an initialized ownership slot
          // (i.e. `ownership.addr != address(0) && ownership.burned == false`)
          // before an unintialized ownership slot
          // (i.e. `ownership.addr == address(0) && ownership.burned == false`)
          // Hence, `curr` will not underflow.
          //
          // We can directly compare the packed value.
          // If the address is zero, packed will be zero.
          while (packed == 0) {
            packed = _packedOwnerships[--curr];
          }
          return packed;
        }
      }
    }
    revert OwnerQueryForNonexistentToken();
  }

  /**
   * @dev Packs ownership data into a single uint256.
   */
  function _packOwnershipData(
    address owner,
    uint256 flags
  ) private view returns (uint256 result) {
    assembly {
      // Mask `owner` to the lower 160 bits, in case the upper bits somehow aren't clean.
      owner := and(owner, _BITMASK_ADDRESS)
      // `owner | (block.timestamp << _BITPOS_START_TIMESTAMP) | flags`.
      result := or(owner, or(shl(_BITPOS_START_TIMESTAMP, timestamp()), flags))
    }
  }

  /**
   * @dev Returns the `nextInitialized` flag set if `quantity` equals 1.
   */
  function _nextInitializedFlag(
    uint256 quantity
  ) private pure returns (uint256 result) {
    // For branchless setting of the `nextInitialized` flag.
    assembly {
      // `(quantity == 1) << _BITPOS_NEXT_INITIALIZED`.
      result := shl(_BITPOS_NEXT_INITIALIZED, eq(quantity, 1))
    }
  }

  // =============================================================
  //                      APPROVAL OPERATIONS
  // =============================================================

  function _approve(address to, uint256 tokenId) internal {
    _tokenApprovals[tokenId] = to;
    emit Approval(ownerOf(tokenId), to, tokenId);
  }

  /**
   * @dev Gives permission to `to` to transfer `tokenId` token to another account.
   * The approval is cleared when the token is transferred.
   *
   * Only a single account can be approved at a time, so approving the
   * zero address clears previous approvals.
   *
   * Requirements:
   *
   * - The caller must own the token or be an approved operator.
   * - `tokenId` must exist.
   *
   * Emits an {Approval} event.
   */
  function approve(address to, uint256 tokenId) external {
    address owner = ownerOf(tokenId);

    if (msg.sender != owner)
      if (!isApprovedForAll(owner, msg.sender))
        revert ApprovalCallerNotOwnerNorApproved();

    _approve(to, tokenId);
  }

  /**
   * @dev Returns the account approved for `tokenId` token.
   *
   * Requirements:
   *
   * - `tokenId` must exist.
   */
  function getApproved(uint256 tokenId) external view returns (address) {
    if (!exists(tokenId)) revert ApprovalQueryForNonexistentToken();

    return _tokenApprovals[tokenId];
  }

  /**
   * @dev Approve or remove `operator` as an operator for the caller.
   * Operators can call {transferFrom} or {safeTransferFrom}
   * for any token owned by the caller.
   *
   * Requirements:
   *
   * - The `operator` cannot be the caller.
   *
   * Emits an {ApprovalForAll} event.
   */
  function setApprovalForAll(address operator, bool approved) external {
    _operatorApprovals[msg.sender][operator] = approved;
    emit ApprovalForAll(msg.sender, operator, approved);
  }

  /**
   * @dev Returns if the `operator` is allowed to manage all of the assets of `owner`.
   *
   * See {setApprovalForAll}.
   */
  function isApprovedForAll(
    address owner,
    address operator
  ) public view returns (bool) {
    return _operatorApprovals[owner][operator];
  }

  /**
   * @dev Returns whether `tokenId` exists.
   *
   * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
   *
   * Tokens start existing when they are minted. See {_mint}.
   */
  function exists(uint256 tokenId) public view returns (bool) {
    return
      // If within bounds
      (tokenId < getStartIndex() ||
        (_INVITATION_START_INDEX <= tokenId &&
          tokenId < getStartIndexInvitations())) &&
      // and not burned
      _packedOwnerships[tokenId] & _BITMASK_BURNED == 0;
  }

  /**
   * @dev Returns whether `msgSender` is equal to `approvedAddress` or `owner`.
   */
  function _isSenderApprovedOrOwner(
    address approvedAddress,
    address owner,
    address msgSender
  ) private pure returns (bool result) {
    assembly {
      // Mask `owner` to the lower 160 bits, in case the upper bits somehow aren't clean.
      owner := and(owner, _BITMASK_ADDRESS)
      // Mask `msgSender` to the lower 160 bits, in case the upper bits somehow aren't clean.
      msgSender := and(msgSender, _BITMASK_ADDRESS)
      // `msgSender == owner || msgSender == approvedAddress`.
      result := or(eq(msgSender, owner), eq(msgSender, approvedAddress))
    }
  }

  // =============================================================
  //                      TRANSFER OPERATIONS
  // =============================================================

  function _transferFrom(address from, address to, uint256 tokenId) internal {
    uint256 prevOwnershipPacked = _packedOwnershipOf(tokenId);

    if (address(uint160(prevOwnershipPacked)) != from)
      revert TransferFromIncorrectOwner();

    // Clear approvals from the previous owner.
    delete _tokenApprovals[tokenId];

    _beforeTokenTransfer(from, to, tokenId);

    // Underflow of the sender's balance is impossible because we check for
    // ownership above and the recipient's balance can't realistically overflow.
    // Counter overflow is incredibly unrealistic as `tokenId` would have to be 2**256.
    unchecked {
      // We can directly increment and decrement the balances.
      --_balances[from];
      ++_balances[to];

      // Updates:
      // - `address` to the next owner.
      // - `startTimestamp` to the timestamp of transfering.
      // - `burned` to `false`.
      // - `nextInitialized` to `true`.
      _packedOwnerships[tokenId] = _packOwnershipData(
        to,
        _BITMASK_NEXT_INITIALIZED |
          _nextExtraData(from, to, prevOwnershipPacked)
      );

      // If the next slot may not have been initialized (i.e. `nextInitialized == false`) .
      if (prevOwnershipPacked & _BITMASK_NEXT_INITIALIZED == 0) {
        uint256 nextTokenId = tokenId + 1;
        // If the next slot's address is zero and not burned (i.e. packed value is zero).
        if (_packedOwnerships[nextTokenId] == 0) {
          // If the next slot is within bounds.
          if (nextTokenId != totalMinted()) {
            // Initialize the next slot to maintain correctness for `ownerOf(tokenId + 1)`.
            _packedOwnerships[nextTokenId] = prevOwnershipPacked;
          }
        }
      }
    }

    emit Transfer(from, to, tokenId);
  }

  /**
   * @dev Transfers `tokenId` from `from` to `to`.
   *
   * Requirements:
   *
   * - `from` cannot be the zero address.
   * - `to` cannot be the zero address.
   * - `tokenId` token must be owned by `from`.
   * - If the caller is not `from`, it must be approved to move this token
   * by either {approve} or {setApprovalForAll}.
   *
   * Emits a {Transfer} event.
   */
  function transferFrom(address from, address to, uint256 tokenId) public {
    address approvedAddress = _tokenApprovals[tokenId];

    // The nested ifs save around 20+ gas over a compound boolean condition.
    if (!_isSenderApprovedOrOwner(approvedAddress, from, msg.sender))
      if (!isApprovedForAll(from, msg.sender))
        revert TransferCallerNotOwnerNorApproved();

    if (to == address(0)) revert TransferToZeroAddress();

    _transferFrom(from, to, tokenId);
  }

  /**
   * @dev Equivalent to `safeTransferFrom(from, to, tokenId, '')`.
   */
  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  ) external {
    safeTransferFrom(from, to, tokenId, "");
  }

  /**
   * @dev Safely transfers `tokenId` token from `from` to `to`.
   *
   * Requirements:
   *
   * - `from` cannot be the zero address.
   * - `to` cannot be the zero address.
   * - `tokenId` token must exist and be owned by `from`.
   * - If the caller is not `from`, it must be approved to move this token
   * by either {approve} or {setApprovalForAll}.
   * - If `to` refers to a smart contract, it must implement
   * {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
   *
   * Emits a {Transfer} event.
   */
  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    bytes memory _data
  ) public {
    transferFrom(from, to, tokenId);
    if (to.code.length != 0)
      if (!_checkContractOnERC721Received(from, to, tokenId, _data)) {
        revert TransferToNonERC721ReceiverImplementer();
      }
  }

  /**
   * @dev Hook that is called before a set of serially-ordered token IDs
   * are about to be transferred. This includes minting.
   * And also called before burning one token.
   *
   * `startTokenId` - the first token ID to be transferred.
   * `quantity` - the amount to be transferred.
   *
   * Calling conditions:
   *
   * - When `from` and `to` are both non-zero, `from`'s `tokenId` will be
   * transferred to `to`.
   * - When `from` is zero, `tokenId` will be minted for `to`.
   * - When `to` is zero, `tokenId` will be burned by `from`.
   * - `from` and `to` are never both zero.
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 startTokenId
  ) internal virtual {}

  function _beforeMintTokenTransfer(
    address to,
    uint256 startTokenId,
    uint256 quantity
  ) internal virtual {}

  /**
   * @dev Private function to invoke {IERC721Receiver-onERC721Received} on a target contract.
   *
   * `from` - Previous owner of the given token ID.
   * `to` - Target address that will receive the token.
   * `tokenId` - Token ID to be transferred.
   * `_data` - Optional data to send along with the call.
   *
   * Returns whether the call correctly returned the expected magic value.
   */
  function _checkContractOnERC721Received(
    address from,
    address to,
    uint256 tokenId,
    bytes memory _data
  ) private returns (bool) {
    try
      IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, _data)
    returns (bytes4 retval) {
      return retval == IERC721Receiver(to).onERC721Received.selector;
    } catch (bytes memory reason) {
      if (reason.length == 0) {
        revert TransferToNonERC721ReceiverImplementer();
      } else {
        revert ReceiverRevert();
      }
    }
  }

  // =============================================================
  //                        MINT OPERATIONS
  // =============================================================

  /**
   * @dev Mints `quantity` tokens and transfers them to `to`.
   *
   * Requirements:
   *
   * - `to` cannot be the zero address.
   * - `quantity` must be greater than 0.
   *
   * Emits a {Transfer} event for each mint.
   */
  function _mint(address to, uint256 startTokenId, uint256 quantity) internal {
    if (quantity == 0) revert MintZeroQuantity();

    _beforeMintTokenTransfer(to, startTokenId, quantity);

    // Overflows are incredibly unrealistic.
    // `balance` and `numberMinted` have a maximum limit of 2**64.
    // `tokenId` has a maximum limit of 2**256.
    unchecked {
      // We can directly add to the `balance`.
      _balances[to] += quantity;

      // Updates:
      // - `address` to the owner.
      // - `startTimestamp` to the timestamp of minting.
      // - `burned` to `false`.
      // - `nextInitialized` to `quantity == 1`.
      _packedOwnerships[startTokenId] = _packOwnershipData(
        to,
        _nextInitializedFlag(quantity) | _nextExtraData(address(0), to, 0)
      );

      uint256 toMasked;
      uint256 end = startTokenId + quantity;

      // Use assembly to loop and emit the `Transfer` event for gas savings.
      // The duplicated `log4` removes an extra check and reduces stack juggling.
      // The assembly, together with the surrounding Solidity code, have been
      // delicately arranged to nudge the compiler into producing optimized opcodes.
      assembly {
        // Mask `to` to the lower 160 bits, in case the upper bits somehow aren't clean.
        toMasked := and(to, _BITMASK_ADDRESS)
        // Emit the `Transfer` event.
        log4(
          0, // Start of data (0, since no data).
          0, // End of data (0, since no data).
          _TRANSFER_EVENT_SIGNATURE, // Signature.
          0, // `address(0)`.
          toMasked, // `to`.
          startTokenId // `tokenId`.
        )

        // The `iszero(eq(,))` check ensures that large values of `quantity`
        // that overflows uint256 will make the loop run out of gas.
        // The compiler will optimize the `iszero` away for performance.
        for {
          let tokenId := add(startTokenId, 1)
        } iszero(eq(tokenId, end)) {
          tokenId := add(tokenId, 1)
        } {
          // Emit the `Transfer` event. Similar to above.
          log4(0, 0, _TRANSFER_EVENT_SIGNATURE, 0, toMasked, tokenId)
        }
      }
      if (toMasked == 0) revert MintToZeroAddress();

      if (_INVITATION_START_INDEX <= startTokenId) {
        totalMintedInvitations += quantity;
      } else {
        totalMintedClassic += quantity;
      }
    }
  }

  // =============================================================
  //                        BURN OPERATIONS
  // =============================================================

  /**
   * @dev Equivalent to `_burn(tokenId, true)`.
   */
  function burn(uint256 tokenId) external {
    _burn(tokenId, true);
  }

  /**
   * @dev Destroys `tokenId`.
   * The approval is cleared when the token is burned.
   *
   * Requirements:
   *
   * - `tokenId` must exist.
   *
   * Emits a {Transfer} event.
   */
  function _burn(uint256 tokenId, bool approvalCheck) internal {
    uint256 prevOwnershipPacked = _packedOwnershipOf(tokenId);

    address from = address(uint160(prevOwnershipPacked));

    address approvedAddress = _tokenApprovals[tokenId];

    if (approvalCheck) {
      // The nested ifs save around 20+ gas over a compound boolean condition.
      if (!_isSenderApprovedOrOwner(approvedAddress, from, msg.sender))
        if (!isApprovedForAll(from, msg.sender))
          revert TransferCallerNotOwnerNorApproved();
    }

    _beforeTokenTransfer(from, address(0), tokenId);

    // Clear approvals from the previous owner.
    if (approvedAddress != address(0)) {
      delete _tokenApprovals[tokenId];
    }

    // Underflow of the sender's balance is impossible because we check for
    // ownership above and the recipient's balance can't realistically overflow.
    // Counter overflow is incredibly unrealistic as `tokenId` would have to be 2**256.
    unchecked {
      // We can directly decrement the balance, and increment the number burned.
      _balances[from] -= 1;

      // Updates:
      // - `address` to the last owner.
      // - `startTimestamp` to the timestamp of burning.
      // - `burned` to `true`.
      // - `nextInitialized` to `true`.
      _packedOwnerships[tokenId] = _packOwnershipData(
        from,
        (_BITMASK_BURNED | _BITMASK_NEXT_INITIALIZED) |
          _nextExtraData(from, address(0), prevOwnershipPacked)
      );

      // If the next slot may not have been initialized (i.e. `nextInitialized == false`) .
      if (prevOwnershipPacked & _BITMASK_NEXT_INITIALIZED == 0) {
        uint256 nextTokenId = tokenId + 1;
        // If the next slot's address is zero and not burned (i.e. packed value is zero).
        if (_packedOwnerships[nextTokenId] == 0) {
          // If the next slot is within bounds.
          if (nextTokenId != totalMinted()) {
            // Initialize the next slot to maintain correctness for `ownerOf(tokenId + 1)`.
            _packedOwnerships[nextTokenId] = prevOwnershipPacked;
          }
        }
      }
    }

    emit Transfer(from, address(0), tokenId);

    // Overflow not possible, as totalBurned cannot be exceed totalMinted() times.
    unchecked {
      totalBurned++;
    }
  }

  // =============================================================
  //                     EXTRA DATA OPERATIONS
  // =============================================================

  /**
   * @dev Returns the next extra data for the packed ownership data.
   * The returned result is shifted into position.
   */
  function _nextExtraData(
    address,
    address,
    uint256 prevOwnershipPacked
  ) private pure returns (uint256) {
    return
      uint256(uint24(prevOwnershipPacked >> _BITPOS_EXTRA_DATA)) <<
      _BITPOS_EXTRA_DATA;
  }

  // =============================================================
  //                       OTHER OPERATIONS
  // =============================================================

  /**
   * @dev Converts a uint256 to its ASCII string decimal representation.
   */
  function _toString(uint256 value) internal pure returns (string memory str) {
    assembly {
      // The maximum value of a uint256 contains 78 digits (1 byte per digit), but
      // we allocate 0xa0 bytes to keep the free memory pointer 32-byte word aligned.
      // We will need 1 word for the trailing zeros padding, 1 word for the length,
      // and 3 words for a maximum of 78 digits. Total: 5 * 0x20 = 0xa0.
      let m := add(mload(0x40), 0xa0)
      // Update the free memory pointer to allocate.
      mstore(0x40, m)
      // Assign the `str` to the end.
      str := sub(m, 0x20)
      // Zeroize the slot after the string.
      mstore(str, 0)

      // Cache the end of the memory to calculate the length later.
      let end := str

      // We write the string from rightmost digit to leftmost digit.
      // The following is essentially a do-while loop that also handles the zero case.
      // prettier-ignore
      for { let temp := value } 1 {} {
                str := sub(str, 1)
                // Write the character to the pointer.
                // The ASCII index of the '0' character is 48.
                mstore8(str, add(48, mod(temp, 10)))
                // Keep dividing `temp` until zero.
                temp := div(temp, 10)
                // prettier-ignore
                if iszero(temp) { break }
            }

      let length := sub(end, str)
      // Move the pointer 32 bytes leftwards to make room for the length.
      str := sub(str, 0x20)
      // Store the length.
      mstore(str, length)
    }
  }
}
