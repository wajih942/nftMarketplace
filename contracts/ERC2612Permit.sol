// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// Interfaces
import { IERC2612Permit } from "./interfaces/IERC2612Permit.sol";

/**
 * @dev Extension of {ERC721} that allows token holders to use their tokens
 * without sending any transactions by setting {IERC721-allowance} with a
 * signature using the {permit} method, and then spend them via
 * {IERC721-transferFrom}.
 *
 * The {permit} signature mechanism conforms to the {IERC2612Permit} interface.
 */
abstract contract ERC2612Permit is IERC2612Permit {
  mapping(address _account => uint256 _nonce) private _nonces;

  // Mapping of ChainID to domain separators. This is a very gas efficient way
  // to not recalculate the domain separator on every call, while still
  // automatically detecting ChainID changes.
  mapping(uint256 => bytes32) public domainSeparators;
  string private _tokenName;

  function _initializeERC721Permit(string memory tokenName_) internal {
    _tokenName = tokenName_;
    _updateDomainSeparator();
  }

  error ERC2612InvalidValueS();
  error ERC2612InvalidValueV();
  error ERC2612InvalidSignature();
  error ERC2612ExpiredPermitDeadline();

  /**
   * @dev Sets `amount` as the allowance of `spender` over `owner`'s tokens,
   * given `owner`'s signed approval.
   *
   * IMPORTANT: The same issues {IERC20-approve} has related to transaction
   * ordering also apply here.
   *
   * Emits an {Approval} event.
   *
   * Requirements:
   *
   * - `owner` cannot be the zero address.
   * - `spender` cannot be the zero address.
   * - `deadline` must be a timestamp in the future.
   * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
   * over the EIP712-formatted function arguments.
   * - the signature must use ``owner``'s current nonce (see {nonces}).
   *
   * For more information on the signature format, see the
   * https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP
   * section].
   */
  function _isValidPermit(
    address owner,
    address spender,
    uint256 tokenId,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) internal returns (bool) {
    if (deadline < block.timestamp) revert ERC2612ExpiredPermitDeadline();

    // Assembly for more efficiently computing:
    // bytes32 hashStruct = keccak256(
    //     abi.encode(
    //         _PERMIT_TYPEHASH,
    //         owner,
    //         spender,
    //         tokenId,
    //         _nonces[owner],
    //         deadline
    //     )
    // );

    bytes32 hashStruct;
    uint256 nonce = _nonces[owner];

    assembly {
      // Load free memory pointer
      let memPtr := mload(64)

      // keccak256("Permit(address owner,address spender,uint256 tokenId,uint256 nonce,uint256 deadline)")
      mstore(
        memPtr,
        0x48d39b37a35214940203bbbd4f383519797769b13d936f387d89430afef27688
      )
      mstore(add(memPtr, 32), owner)
      mstore(add(memPtr, 64), spender)
      mstore(add(memPtr, 96), tokenId)
      mstore(add(memPtr, 128), nonce)
      mstore(add(memPtr, 160), deadline)

      hashStruct := keccak256(memPtr, 192)
    }

    bytes32 eip712DomainHash = _domainSeparator();

    // Assembly for more efficient computing:
    // bytes32 hash = keccak256(
    //     abi.encodePacked(uint16(0x1901), eip712DomainHash, hashStruct)
    // );

    bytes32 hash;

    assembly {
      // Load free memory pointer
      let memPtr := mload(64)

      mstore(
        memPtr,
        0x1901000000000000000000000000000000000000000000000000000000000000
      ) // EIP191 header
      mstore(add(memPtr, 2), eip712DomainHash) // EIP712 domain hash
      mstore(add(memPtr, 34), hashStruct) // Hash of struct

      hash := keccak256(memPtr, 66)
    }

    address signer = _recover(hash, v, r, s);

    _nonces[owner]++;

    return signer == owner;
  }

  /**
   * @dev See {IERC2612Permit-nonces}.
   */
  function nonces(address owner) public view override returns (uint256) {
    return _nonces[owner];
  }

  function _updateDomainSeparator() private returns (bytes32) {
    uint256 chainID = getChainId();

    // no need for assembly, running very rarely
    bytes32 newDomainSeparator = keccak256(
      abi.encode(
        keccak256(
          "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        ),
        keccak256(bytes(_tokenName)), // Token ticker
        keccak256(bytes("1")), // Version
        chainID,
        address(this)
      )
    );

    domainSeparators[chainID] = newDomainSeparator;

    return newDomainSeparator;
  }

  // Returns the domain separator, updating it if chainID changes
  function _domainSeparator() private returns (bytes32) {
    bytes32 domainSeparator = domainSeparators[getChainId()];

    if (domainSeparator != 0x00) {
      return domainSeparator;
    }

    return _updateDomainSeparator();
  }

  function getChainId() public view returns (uint256 chainID) {
    assembly {
      chainID := chainid()
    }
  }

  function _recover(
    bytes32 hash,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) internal pure returns (address) {
    // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
    // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
    // the valid range for s in (281): 0 < s < secp256k1n ÷ 2 + 1, and for v in (282): v ∈ {27, 28}. Most
    // signatures from current libraries generate a unique signature with an s-value in the lower half order.
    //
    // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
    // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
    // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
    // these malleable signatures as well.
    if (
      uint256(s) >
      0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
    ) {
      revert ERC2612InvalidValueS();
    }

    if (v != 27 && v != 28) {
      revert ERC2612InvalidValueV();
    }

    // If the signature is valid (and not malleable), return the signer address
    address signer = ecrecover(hash, v, r, s);
    if (signer == address(0)) revert ERC2612InvalidSignature();

    return signer;
  }
}
