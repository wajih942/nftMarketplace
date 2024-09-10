// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Interfaces
import { IERC721Royalty } from "./interfaces/IERC721Royalty.sol";
import { IERC165 } from "./interfaces/IERC165.sol";

/**
 * @dev Implementation of the NFT Royalty Standard, a standardized way to retrieve royalty payment information.
 *
 * Royalty information can be specified globally for all token ids via {_setDefaultRoyalty}, and/or individually for
 * specific token ids via {_setTokenRoyalty}. The latter takes precedence over the first.
 *
 * Royalty is specified as a fraction of sale price. {_feeDenominator} is overridable but defaults to 10_000, meaning the
 * fee is specified in basis points by default.
 *
 * IMPORTANT: ERC-2981 only specifies a way to signal royalty information and does not enforce its payment. See
 * https://eips.ethereum.org/EIPS/eip-2981#optional-royalty-payments[Rationale] in the EIP. Marketplaces are expected to
 * voluntarily pay royalties together with sales, but note that this standard is not yet widely supported.
 *
 */
contract ERC721Royalty is IERC721Royalty {
  uint256 private _royaltyFee;
  address private _royaltyReceiver;

  //======= ERRORS =======//
  //======================//

  error RoyaltyFeeExceedsSalesPrice();
  error RoyaltyReceiverZeroAddress();

  //======= VIEWS =======//
  //=====================//

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(IERC165) returns (bool) {
    return interfaceId == type(IERC721Royalty).interfaceId;
  }

  /**
   * @inheritdoc IERC721Royalty
   */
  function royaltyInfo(
    uint256,
    uint256 _salePrice
  ) public view override returns (address, uint256) {
    uint256 royaltyAmount = (_salePrice * _royaltyFee) / _feeDenominator();

    return (_royaltyReceiver, royaltyAmount);
  }

  /**
   * @dev The denominator with which to interpret the fee set in {_setTokenRoyalty} and {_setDefaultRoyalty} as a
   * fraction of the sale price. Defaults to 10 000 = 100% so fees are expressed in basis points, but may be customized by an
   * override.
   */
  function _feeDenominator() internal pure returns (uint96) {
    return 10_000;
  }

  //======= ADMIN =======//
  //=====================//

  /**
   * @dev Sets the royalty information that all ids in this contract will default to.
   *
   * Requirements:
   *
   * - `receiver` cannot be the zero address.
   * - `feeNumerator` cannot be greater than the fee denominator.
   */
  function _setDefaultRoyalty(
    address royaltyReceiver_,
    uint96 royaltyFee_
  ) internal {
    if (royaltyReceiver_ == address(0)) revert RoyaltyReceiverZeroAddress();
    if (_feeDenominator() <= royaltyFee_) revert RoyaltyFeeExceedsSalesPrice();

    _royaltyReceiver = royaltyReceiver_;
    _royaltyFee = royaltyFee_;
  }
}
