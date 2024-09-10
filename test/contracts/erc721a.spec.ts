import { expect } from "chai";
import { ethers } from "hardhat";
import { TickieNFT, ERC721ReceiverMock } from "../../typechain";
import {
  deployTickieFactoryContract,
  deployTickieNFTContract,
  deployERC721ReceiverMock,
} from "../helpers/ProtocolHelper";
import { getCustomError } from "../helpers/HardhatHelper";
import { typedContract } from "../helpers/TypedContracts";

const BYTES_ZERO = "0x0000000000000000000000000000000000000000";

const { TickieNFT } = typedContract;

let NFT_CONTRACT: TickieNFT;
let NFT_RECEIVER_CONTRACT: ERC721ReceiverMock;

export function shouldBehaveLikeErc721A(): void {
  context("ERC-721A", function () {
    beforeEach(async function () {
      const deployerWallet = this.signers.deployer;

      this.INVITATION_START_INDEX = 1000000;

      const implementationContract = await deployTickieNFTContract(
        deployerWallet,
      );

      const NFT_FACTORY = await deployTickieFactoryContract(
        deployerWallet,
        implementationContract.address,
      );

      await (
        await NFT_FACTORY.connect(deployerWallet).deployCollection(
          true,
          true,
          "Tickie Test",
          "www.example.com/collection-0/",
        )
      ).wait();
      const proxyAddress = await NFT_FACTORY.collections(0);
      NFT_CONTRACT = TickieNFT(proxyAddress).connect(deployerWallet);

      NFT_RECEIVER_CONTRACT = await deployERC721ReceiverMock(
        deployerWallet,
        "0x150b7a02",
        NFT_CONTRACT.address,
      );
    });

    describe("EIP-165 support", async function () {
      it("supports ERC165", async function () {
        expect(await NFT_CONTRACT.supportsInterface("0x01ffc9a7")).to.eq(true);
      });

      it("supports ERC721", async function () {
        expect(await NFT_CONTRACT.supportsInterface("0x80ac58cd")).to.eq(true);
      });

      it("supports ERC721Metadata", async function () {
        expect(await NFT_CONTRACT.supportsInterface("0x5b5e139f")).to.eq(true);
      });

      it("supports ERC721Enumerable", async function () {
        expect(await NFT_CONTRACT.supportsInterface("0x780e9d63")).to.eq(true);
      });

      it("supports ERC721Royalty", async function () {
        expect(await NFT_CONTRACT.supportsInterface("0x2a55205a")).to.eq(true);
      });

      it("does not support random interface", async function () {
        expect(await NFT_CONTRACT.supportsInterface("0x00000042")).to.eq(false);
      });
    });

    describe("ERC721Metadata support", async function () {
      it("name", async function () {
        expect(await NFT_CONTRACT.name()).to.eq("Tickie Test");
      });

      it("symbol", async function () {
        expect(await NFT_CONTRACT.symbol()).to.eq("TICKIE NFT");
      });

      describe("baseURI", async function () {
        it("sends the base URI", async function () {
          expect(await NFT_CONTRACT.baseURI()).to.eq(
            "www.example.com/collection-0/",
          );
        });
      });
    });

    context("with no minted tokens", async function () {
      it("has 0 totalSupply", async function () {
        const supply = await NFT_CONTRACT.totalSupply();
        expect(supply).to.equal(0);
      });

      it("has 0 totalMinted", async function () {
        const totalMinted = await NFT_CONTRACT.totalMinted();
        expect(totalMinted).to.equal(0);
      });

      it("has 0 totalBurned", async function () {
        const totalBurned = await NFT_CONTRACT.totalBurned();
        expect(totalBurned).to.equal(0);
      });
    });

    context("with minted tokens", async function () {
      beforeEach(async function () {
        const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();
        this.owner = owner;
        this.addr1 = addr1;
        this.addr2 = addr2;
        this.addr3 = addr3;
        this.addr4 = addr4;
        this.expectedMintCount = 6;

        this.addr1.expected = {
          mintCount: 1,
          tokens: [0],
        };

        this.addr2.expected = {
          mintCount: 2,
          tokens: [1, 2],
        };

        this.addr3.expected = {
          mintCount: 3,
          tokens: [3, 4, 5],
        };

        await NFT_CONTRACT.mintTickets(
          addr1.address,
          this.addr1.expected.mintCount,
        );
        await NFT_CONTRACT.mintTickets(
          addr2.address,
          this.addr2.expected.mintCount,
        );
        await NFT_CONTRACT.mintTickets(
          addr3.address,
          this.addr3.expected.mintCount,
        );
      });

      describe("tokenURI (ERC721Metadata)", async function () {
        it("reverts when tokenId does not exist", async function () {
          expect(
            await getCustomError(NFT_CONTRACT.tokenURI(this.expectedMintCount)),
          ).to.equal("URIQueryForNonexistentToken");
        });
      });

      describe("exists", async function () {
        it("verifies valid tokens", async function () {
          for (let tokenId = 0; tokenId < this.expectedMintCount; tokenId++) {
            const exists = await NFT_CONTRACT.exists(tokenId);
            expect(exists).to.be.true;
          }
        });

        it("verifies invalid tokens", async function () {
          expect(await NFT_CONTRACT.exists(this.expectedMintCount)).to.be.false;
        });
      });

      describe("balanceOf", async function () {
        it("returns the amount for a given address", async function () {
          expect(await NFT_CONTRACT.balanceOf(this.owner.address)).to.equal(
            "0",
          );
          expect(await NFT_CONTRACT.balanceOf(this.addr1.address)).to.equal(
            this.addr1.expected.mintCount,
          );
          expect(await NFT_CONTRACT.balanceOf(this.addr2.address)).to.equal(
            this.addr2.expected.mintCount,
          );
          expect(await NFT_CONTRACT.balanceOf(this.addr3.address)).to.equal(
            this.addr3.expected.mintCount,
          );
        });

        it("returns correct amount with transferred tokens", async function () {
          const tokenIdToTransfer = this.addr2.expected.tokens[0];
          await NFT_CONTRACT.connect(this.addr2).transferFrom(
            this.addr2.address,
            this.addr3.address,
            tokenIdToTransfer,
          );
          // sanity check
          expect(await NFT_CONTRACT.ownerOf(tokenIdToTransfer)).to.equal(
            this.addr3.address,
          );

          expect(await NFT_CONTRACT.balanceOf(this.addr2.address)).to.equal(
            this.addr2.expected.mintCount - 1,
          );
          expect(await NFT_CONTRACT.balanceOf(this.addr3.address)).to.equal(
            this.addr3.expected.mintCount + 1,
          );
        });
      });

      context("_totalMinted", async function () {
        it("has correct totalMinted", async function () {
          const totalMinted = await NFT_CONTRACT.totalMinted();
          expect(totalMinted).to.equal(this.expectedMintCount);
        });
      });

      describe("ownerOf", async function () {
        it("returns the right owner", async function () {
          for (const minter of [this.addr1, this.addr2, this.addr3]) {
            for (const tokenId of minter.expected.tokens) {
              expect(await NFT_CONTRACT.ownerOf(tokenId)).to.equal(
                minter.address,
              );
            }
          }
        });

        it("reverts for an invalid token", async function () {
          expect(await getCustomError(NFT_CONTRACT.ownerOf(10))).to.equal(
            "OwnerQueryForNonexistentToken",
          );

          if (this.startTokenId > 0) {
            expect(await getCustomError(NFT_CONTRACT.ownerOf(0))).to.equal(
              "OwnerQueryForNonexistentToken",
            );
          }
        });
      });

      describe("approve", async function () {
        beforeEach(function () {
          this.tokenId = this.addr1.expected.tokens[0];
          this.tokenId2 = this.addr2.expected.tokens[0];
        });

        it("sets approval for the target address", async function () {
          await NFT_CONTRACT.connect(this.addr1).approve(
            this.addr2.address,
            this.tokenId,
          );
          const approval = await NFT_CONTRACT.getApproved(this.tokenId);
          expect(approval).to.equal(this.addr2.address);
        });

        it("set approval for the target address on behalf of the owner", async function () {
          await NFT_CONTRACT.connect(this.addr1).setApprovalForAll(
            this.addr2.address,
            true,
          );
          await NFT_CONTRACT.connect(this.addr2).approve(
            this.addr3.address,
            this.tokenId,
          );
          const approval = await NFT_CONTRACT.getApproved(this.tokenId);
          expect(approval).to.equal(this.addr3.address);
        });

        it("rejects an unapproved caller", async function () {
          expect(
            await getCustomError(
              NFT_CONTRACT.approve(this.addr2.address, this.tokenId),
            ),
          ).to.equal("ApprovalCallerNotOwnerNorApproved");
        });

        it("does not get approved for invalid tokens", async function () {
          expect(await getCustomError(NFT_CONTRACT.getApproved(10))).to.equal(
            "ApprovalQueryForNonexistentToken",
          );
        });

        it("approval allows token transfer", async function () {
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.addr3).transferFrom(
                this.addr1.address,
                this.addr3.address,
                this.tokenId,
              ),
            ),
          ).to.equal("TransferCallerNotOwnerNorApproved");
          await NFT_CONTRACT.connect(this.addr1).approve(
            this.addr3.address,
            this.tokenId,
          );
          await NFT_CONTRACT.connect(this.addr3).transferFrom(
            this.addr1.address,
            this.addr3.address,
            this.tokenId,
          );
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.addr1).transferFrom(
                this.addr3.address,
                this.addr1.address,
                this.tokenId,
              ),
            ),
          ).to.equal("TransferCallerNotOwnerNorApproved");
        });

        it("token owner can approve self as operator", async function () {
          expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.not.equal(
            this.addr1.address,
          );
          await expect(
            NFT_CONTRACT.connect(this.addr1).approve(
              this.addr1.address,
              this.tokenId,
            ),
          ).to.not.be.reverted;
          expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.equal(
            this.addr1.address,
          );
        });

        it("self-approval is cleared on token transfer", async function () {
          await NFT_CONTRACT.connect(this.addr1).approve(
            this.addr1.address,
            this.tokenId,
          );
          expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.equal(
            this.addr1.address,
          );

          await NFT_CONTRACT.connect(this.addr1).transferFrom(
            this.addr1.address,
            this.addr2.address,
            this.tokenId,
          );
          expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.not.equal(
            this.addr1.address,
          );
        });
      });

      describe("setApprovalForAll", async function () {
        it("sets approval for all properly", async function () {
          const approvalTx = await NFT_CONTRACT.setApprovalForAll(
            this.addr1.address,
            true,
          );
          await expect(approvalTx)
            .to.emit(NFT_CONTRACT, "ApprovalForAll")
            .withArgs(this.owner.address, this.addr1.address, true);
          expect(
            await NFT_CONTRACT.isApprovedForAll(
              this.owner.address,
              this.addr1.address,
            ),
          ).to.be.true;
        });

        it("caller can approve all with self as operator", async function () {
          expect(
            await NFT_CONTRACT.connect(this.addr1).isApprovedForAll(
              this.addr1.address,
              this.addr1.address,
            ),
          ).to.be.false;
          await expect(
            NFT_CONTRACT.connect(this.addr1).setApprovalForAll(
              this.addr1.address,
              true,
            ),
          ).to.not.be.reverted;
          expect(
            await NFT_CONTRACT.connect(this.addr1).isApprovedForAll(
              this.addr1.address,
              this.addr1.address,
            ),
          ).to.be.true;
        });
      });

      context("test transfer functionality", function () {
        const testSuccessfulTransfer = function (
          transferFn:
            | "transferFrom"
            | "safeTransferFrom(address,address,uint256)",
          transferToContract = true,
        ) {
          beforeEach(async function () {
            const sender = this.addr2;
            this.tokenId = this.addr2.expected.tokens[0];
            this.from = sender.address;
            this.to = transferToContract ? NFT_RECEIVER_CONTRACT : this.addr4;
            await NFT_CONTRACT.connect(sender).approve(
              this.to.address,
              this.tokenId,
            );

            this.transferTx = await NFT_CONTRACT.connect(sender)[transferFn](
              this.from,
              this.to.address,
              this.tokenId,
            );
          });

          it("transfers the ownership of the given token ID to the given address", async function () {
            expect(await NFT_CONTRACT.ownerOf(this.tokenId)).to.be.equal(
              this.to.address,
            );
          });

          it("emits a Transfer event", async function () {
            await expect(this.transferTx)
              .to.emit(NFT_CONTRACT, "Transfer")
              .withArgs(this.from, this.to.address, this.tokenId);
          });

          it("clears the approval for the token ID", async function () {
            expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.be.equal(
              BYTES_ZERO,
            );
          });

          it("adjusts owners balances", async function () {
            expect(await NFT_CONTRACT.balanceOf(this.from)).to.be.equal(1);
          });
        };

        const testUnsuccessfulTransfer = function (
          transferFn:
            | "transferFrom"
            | "safeTransferFrom(address,address,uint256)",
        ) {
          beforeEach(function () {
            this.tokenId = this.addr2.expected.tokens[0];
            this.sender = this.addr1;
          });

          it("rejects unapproved transfer", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.sender)[transferFn](
                  this.addr2.address,
                  this.sender.address,
                  this.tokenId,
                ),
              ),
            ).to.equal("TransferCallerNotOwnerNorApproved");
          });

          it("rejects transfer from incorrect owner", async function () {
            await NFT_CONTRACT.connect(this.addr2).setApprovalForAll(
              this.sender.address,
              true,
            );
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.sender)[transferFn](
                  this.addr3.address,
                  this.sender.address,
                  this.tokenId,
                ),
              ),
            ).to.equal("TransferCallerNotOwnerNorApproved");
          });

          it("rejects transfer to zero address", async function () {
            await NFT_CONTRACT.connect(this.addr2).setApprovalForAll(
              this.sender.address,
              true,
            );
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.sender)[transferFn](
                  this.addr2.address,
                  BYTES_ZERO,
                  this.tokenId,
                ),
              ),
            ).to.equal("TransferToZeroAddress");
          });
        };

        context("successful transfers", function () {
          context("transferFrom", function () {
            describe("to contract", function () {
              testSuccessfulTransfer("transferFrom");
            });

            describe("to EOA", function () {
              testSuccessfulTransfer("transferFrom", false);
            });
          });

          context("safeTransferFrom", function () {
            describe("to contract", function () {
              testSuccessfulTransfer(
                "safeTransferFrom(address,address,uint256)",
              );

              it("validates ERC721Received", async function () {
                await expect(this.transferTx)
                  .to.emit(NFT_RECEIVER_CONTRACT, "Received")
                  .withArgs(
                    this.addr2.address,
                    this.addr2.address,
                    this.tokenId,
                    "0x",
                    20_000,
                  );
              });
            });

            describe("to EOA", function () {
              testSuccessfulTransfer(
                "safeTransferFrom(address,address,uint256)",
                false,
              );
            });
          });
        });

        context("unsuccessful transfers", function () {
          describe("transferFrom", function () {
            testUnsuccessfulTransfer("transferFrom");
          });

          describe("safeTransferFrom", function () {
            testUnsuccessfulTransfer(
              "safeTransferFrom(address,address,uint256)",
            );

            it("reverts for non-receivers", async function () {
              const nonReceiver = NFT_CONTRACT;

              expect(
                await getCustomError(
                  NFT_CONTRACT.connect(this.addr1)[
                    "safeTransferFrom(address,address,uint256)"
                  ](
                    this.addr1.address,
                    nonReceiver.address,
                    this.addr1.expected.tokens[0],
                  ),
                ),
              ).to.equal("TransferToNonERC721ReceiverImplementer");
            });

            it("reverts when the receiver reverted", async function () {
              expect(
                await getCustomError(
                  NFT_CONTRACT.connect(this.addr1)[
                    "safeTransferFrom(address,address,uint256,bytes)"
                  ](
                    this.addr1.address,
                    NFT_RECEIVER_CONTRACT.address,
                    this.addr1.expected.tokens[0],
                    "0x01",
                  ),
                ),
              ).to.equal("ReceiverRevert");
            });

            it("reverts if the receiver returns the wrong value", async function () {
              expect(
                await getCustomError(
                  NFT_CONTRACT.connect(this.addr1)[
                    "safeTransferFrom(address,address,uint256,bytes)"
                  ](
                    this.addr1.address,
                    NFT_RECEIVER_CONTRACT.address,
                    this.addr1.expected.tokens[0],
                    "0x02",
                  ),
                ),
              ).to.equal("TransferToNonERC721ReceiverImplementer");
            });
          });
        });
      });

      describe("burn", async function () {
        beforeEach(async function () {
          this.owner = this.addr2;
          this.spender = this.addr1;
          this.tokenIdToBurn = this.addr2.expected.tokens[0];
        });

        it("can burn account own token", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          await NFT_CONTRACT.connect(this.owner).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;
        });

        it("updates amount of burned tokens", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          await NFT_CONTRACT.connect(this.owner).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;

          const totalBurned = await NFT_CONTRACT.totalBurned();
          expect(totalBurned).to.equal(1);
        });

        it("updates account balance", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          expect(await NFT_CONTRACT.balanceOf(this.owner.address)).to.equal(2);
          await NFT_CONTRACT.connect(this.owner).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;
          expect(await NFT_CONTRACT.balanceOf(this.owner.address)).to.equal(1);
        });

        it("cannot transferFrom a burned token", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          await NFT_CONTRACT.connect(this.owner).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.owner).transferFrom(
                this.owner.address,
                this.spender.address,
                this.tokenIdToBurn,
              ),
            ),
          ).to.equal("OwnerQueryForNonexistentToken");
        });

        it("cannot burn a token owned by another if not approved", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.spender).burn(this.tokenIdToBurn),
            ),
          ).to.equal("TransferCallerNotOwnerNorApproved");
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
        });

        it("can burn a token owned by another if approved", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          await NFT_CONTRACT.connect(this.owner).approve(
            this.spender.address,
            this.tokenIdToBurn,
          );
          const approval = await NFT_CONTRACT.getApproved(this.tokenIdToBurn);
          expect(approval).to.equal(this.spender.address);
          await NFT_CONTRACT.connect(this.spender).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;
        });
      });
    });

    context("with minted invitation tokens", async function () {
      beforeEach(async function () {
        const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();
        this.owner = owner;
        this.addr1 = addr1;
        this.addr2 = addr2;
        this.addr3 = addr3;
        this.addr4 = addr4;
        this.expectedMintCount = 12;

        this.addr1.expected = {
          mintCount: 2,
          tokens: [0, 1000000],
        };

        this.addr2.expected = {
          mintCount: 4,
          tokens: [1, 2, 1000001, 1000002],
        };

        this.addr3.expected = {
          mintCount: 6,
          tokens: [3, 4, 5, 1000003, 1000004, 1000005],
        };

        await NFT_CONTRACT.mintTickets(
          addr1.address,
          this.addr1.expected.mintCount / 2,
        );
        await NFT_CONTRACT.mintTickets(
          addr2.address,
          this.addr2.expected.mintCount / 2,
        );
        await NFT_CONTRACT.mintTickets(
          addr3.address,
          this.addr3.expected.mintCount / 2,
        );

        await NFT_CONTRACT.mintInvitationTicket(
          addr1.address,
          this.addr1.expected.mintCount / 2,
        );
        await NFT_CONTRACT.mintInvitationTicket(
          addr2.address,
          this.addr2.expected.mintCount / 2,
        );
        await NFT_CONTRACT.mintInvitationTicket(
          addr3.address,
          this.addr3.expected.mintCount / 2,
        );
      });

      describe("tokenURI (ERC721Metadata)", async function () {
        it("reverts when tokenId does not exist", async function () {
          expect(
            await getCustomError(NFT_CONTRACT.tokenURI(this.expectedMintCount)),
          ).to.equal("URIQueryForNonexistentToken");
        });
      });

      describe("exists", async function () {
        it("verifies valid tokens", async function () {
          const countPerType = this.expectedMintCount / 2;

          for (let tokenId = 0; tokenId < countPerType; tokenId++) {
            const exists = await NFT_CONTRACT.exists(tokenId);
            expect(exists).to.be.true;
          }

          for (let tokenId = 0; tokenId < countPerType; tokenId++) {
            const exists = await NFT_CONTRACT.exists(
              this.INVITATION_START_INDEX + tokenId,
            );
            expect(exists).to.be.true;
          }
        });

        it("verifies invalid tokens", async function () {
          expect(await NFT_CONTRACT.exists(this.expectedMintCount)).to.be.false;
        });
      });

      describe("balanceOf", async function () {
        it("returns the amount for a given address", async function () {
          expect(await NFT_CONTRACT.balanceOf(this.owner.address)).to.equal(
            "0",
          );
          expect(await NFT_CONTRACT.balanceOf(this.addr1.address)).to.equal(
            this.addr1.expected.mintCount,
          );
          expect(await NFT_CONTRACT.balanceOf(this.addr2.address)).to.equal(
            this.addr2.expected.mintCount,
          );
          expect(await NFT_CONTRACT.balanceOf(this.addr3.address)).to.equal(
            this.addr3.expected.mintCount,
          );
        });

        it("returns correct amount with transferred tokens", async function () {
          const tokenIdToTransfer = this.addr2.expected.tokens[0];
          await NFT_CONTRACT.connect(this.addr2).transferFrom(
            this.addr2.address,
            this.addr3.address,
            tokenIdToTransfer,
          );
          // sanity check
          expect(await NFT_CONTRACT.ownerOf(tokenIdToTransfer)).to.equal(
            this.addr3.address,
          );

          expect(await NFT_CONTRACT.balanceOf(this.addr2.address)).to.equal(
            this.addr2.expected.mintCount - 1,
          );
          expect(await NFT_CONTRACT.balanceOf(this.addr3.address)).to.equal(
            this.addr3.expected.mintCount + 1,
          );
        });
      });

      context("_totalMinted", async function () {
        it("has correct totalMinted", async function () {
          const totalMinted = await NFT_CONTRACT.totalMinted();
          expect(totalMinted).to.equal(this.expectedMintCount);
        });
      });

      describe("ownerOf", async function () {
        it("returns the right owner", async function () {
          for (const minter of [this.addr1, this.addr2, this.addr3]) {
            for (const tokenId of minter.expected.tokens) {
              expect(await NFT_CONTRACT.ownerOf(tokenId)).to.equal(
                minter.address,
              );
            }
          }
        });

        it("reverts for an invalid token", async function () {
          expect(await getCustomError(NFT_CONTRACT.ownerOf(10))).to.equal(
            "OwnerQueryForNonexistentToken",
          );

          if (this.startTokenId > 0) {
            expect(await getCustomError(NFT_CONTRACT.ownerOf(0))).to.equal(
              "OwnerQueryForNonexistentToken",
            );
          }
        });
      });

      describe("approve", async function () {
        beforeEach(function () {
          this.tokenId = this.addr1.expected.tokens[0];
          this.tokenId2 = this.addr2.expected.tokens[0];
        });

        it("sets approval for the target address", async function () {
          await NFT_CONTRACT.connect(this.addr1).approve(
            this.addr2.address,
            this.tokenId,
          );
          const approval = await NFT_CONTRACT.getApproved(this.tokenId);
          expect(approval).to.equal(this.addr2.address);
        });

        it("set approval for the target address on behalf of the owner", async function () {
          await NFT_CONTRACT.connect(this.addr1).setApprovalForAll(
            this.addr2.address,
            true,
          );
          await NFT_CONTRACT.connect(this.addr2).approve(
            this.addr3.address,
            this.tokenId,
          );
          const approval = await NFT_CONTRACT.getApproved(this.tokenId);
          expect(approval).to.equal(this.addr3.address);
        });

        it("rejects an unapproved caller", async function () {
          expect(
            await getCustomError(
              NFT_CONTRACT.approve(this.addr2.address, this.tokenId),
            ),
          ).to.equal("ApprovalCallerNotOwnerNorApproved");
        });

        it("does not get approved for invalid tokens", async function () {
          expect(await getCustomError(NFT_CONTRACT.getApproved(10))).to.equal(
            "ApprovalQueryForNonexistentToken",
          );
        });

        it("approval allows token transfer", async function () {
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.addr3).transferFrom(
                this.addr1.address,
                this.addr3.address,
                this.tokenId,
              ),
            ),
          ).to.equal("TransferCallerNotOwnerNorApproved");
          await NFT_CONTRACT.connect(this.addr1).approve(
            this.addr3.address,
            this.tokenId,
          );
          await NFT_CONTRACT.connect(this.addr3).transferFrom(
            this.addr1.address,
            this.addr3.address,
            this.tokenId,
          );
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.addr1).transferFrom(
                this.addr3.address,
                this.addr1.address,
                this.tokenId,
              ),
            ),
          ).to.equal("TransferCallerNotOwnerNorApproved");
        });

        it("token owner can approve self as operator", async function () {
          expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.not.equal(
            this.addr1.address,
          );
          await expect(
            NFT_CONTRACT.connect(this.addr1).approve(
              this.addr1.address,
              this.tokenId,
            ),
          ).to.not.be.reverted;
          expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.equal(
            this.addr1.address,
          );
        });

        it("self-approval is cleared on token transfer", async function () {
          await NFT_CONTRACT.connect(this.addr1).approve(
            this.addr1.address,
            this.tokenId,
          );
          expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.equal(
            this.addr1.address,
          );

          await NFT_CONTRACT.connect(this.addr1).transferFrom(
            this.addr1.address,
            this.addr2.address,
            this.tokenId,
          );
          expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.not.equal(
            this.addr1.address,
          );
        });
      });

      describe("setApprovalForAll", async function () {
        it("sets approval for all properly", async function () {
          const approvalTx = await NFT_CONTRACT.setApprovalForAll(
            this.addr1.address,
            true,
          );
          await expect(approvalTx)
            .to.emit(NFT_CONTRACT, "ApprovalForAll")
            .withArgs(this.owner.address, this.addr1.address, true);
          expect(
            await NFT_CONTRACT.isApprovedForAll(
              this.owner.address,
              this.addr1.address,
            ),
          ).to.be.true;
        });

        it("caller can approve all with self as operator", async function () {
          expect(
            await NFT_CONTRACT.connect(this.addr1).isApprovedForAll(
              this.addr1.address,
              this.addr1.address,
            ),
          ).to.be.false;
          await expect(
            NFT_CONTRACT.connect(this.addr1).setApprovalForAll(
              this.addr1.address,
              true,
            ),
          ).to.not.be.reverted;
          expect(
            await NFT_CONTRACT.connect(this.addr1).isApprovedForAll(
              this.addr1.address,
              this.addr1.address,
            ),
          ).to.be.true;
        });
      });

      context("test transfer functionality", function () {
        const testSuccessfulTransfer = function (
          transferFn:
            | "transferFrom"
            | "safeTransferFrom(address,address,uint256)",
          transferToContract = true,
        ) {
          beforeEach(async function () {
            const sender = this.addr2;
            this.tokenId = this.addr2.expected.tokens[0];
            this.from = sender.address;
            this.to = transferToContract ? NFT_RECEIVER_CONTRACT : this.addr4;
            await NFT_CONTRACT.connect(sender).approve(
              this.to.address,
              this.tokenId,
            );

            this.transferTx = await NFT_CONTRACT.connect(sender)[transferFn](
              this.from,
              this.to.address,
              this.tokenId,
            );
          });

          it("transfers the ownership of the given token ID to the given address", async function () {
            expect(await NFT_CONTRACT.ownerOf(this.tokenId)).to.be.equal(
              this.to.address,
            );
          });

          it("emits a Transfer event", async function () {
            await expect(this.transferTx)
              .to.emit(NFT_CONTRACT, "Transfer")
              .withArgs(this.from, this.to.address, this.tokenId);
          });

          it("clears the approval for the token ID", async function () {
            expect(await NFT_CONTRACT.getApproved(this.tokenId)).to.be.equal(
              BYTES_ZERO,
            );
          });

          it("adjusts owners balances", async function () {
            expect(await NFT_CONTRACT.balanceOf(this.from)).to.be.equal(3);
          });
        };

        const testUnsuccessfulTransfer = function (
          transferFn:
            | "transferFrom"
            | "safeTransferFrom(address,address,uint256)",
        ) {
          beforeEach(function () {
            this.tokenId = this.addr2.expected.tokens[0];
            this.sender = this.addr1;
          });

          it("rejects unapproved transfer", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.sender)[transferFn](
                  this.addr2.address,
                  this.sender.address,
                  this.tokenId,
                ),
              ),
            ).to.equal("TransferCallerNotOwnerNorApproved");
          });

          it("rejects transfer from incorrect owner", async function () {
            await NFT_CONTRACT.connect(this.addr2).setApprovalForAll(
              this.sender.address,
              true,
            );
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.sender)[transferFn](
                  this.addr3.address,
                  this.sender.address,
                  this.tokenId,
                ),
              ),
            ).to.equal("TransferCallerNotOwnerNorApproved");
          });

          it("rejects transfer to zero address", async function () {
            await NFT_CONTRACT.connect(this.addr2).setApprovalForAll(
              this.sender.address,
              true,
            );
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.sender)[transferFn](
                  this.addr2.address,
                  BYTES_ZERO,
                  this.tokenId,
                ),
              ),
            ).to.equal("TransferToZeroAddress");
          });
        };

        context("successful transfers", function () {
          context("transferFrom", function () {
            describe("to contract", function () {
              testSuccessfulTransfer("transferFrom");
            });

            describe("to EOA", function () {
              testSuccessfulTransfer("transferFrom", false);
            });
          });

          context("safeTransferFrom", function () {
            describe("to contract", function () {
              testSuccessfulTransfer(
                "safeTransferFrom(address,address,uint256)",
              );

              it("validates ERC721Received", async function () {
                await expect(this.transferTx)
                  .to.emit(NFT_RECEIVER_CONTRACT, "Received")
                  .withArgs(
                    this.addr2.address,
                    this.addr2.address,
                    this.tokenId,
                    "0x",
                    20_000,
                  );
              });
            });

            describe("to EOA", function () {
              testSuccessfulTransfer(
                "safeTransferFrom(address,address,uint256)",
                false,
              );
            });
          });
        });

        context("unsuccessful transfers", function () {
          describe("transferFrom", function () {
            testUnsuccessfulTransfer("transferFrom");
          });

          describe("safeTransferFrom", function () {
            testUnsuccessfulTransfer(
              "safeTransferFrom(address,address,uint256)",
            );

            it("reverts for non-receivers", async function () {
              const nonReceiver = NFT_CONTRACT;

              expect(
                await getCustomError(
                  NFT_CONTRACT.connect(this.addr1)[
                    "safeTransferFrom(address,address,uint256)"
                  ](
                    this.addr1.address,
                    nonReceiver.address,
                    this.addr1.expected.tokens[0],
                  ),
                ),
              ).to.equal("TransferToNonERC721ReceiverImplementer");
            });

            it("reverts when the receiver reverted", async function () {
              expect(
                await getCustomError(
                  NFT_CONTRACT.connect(this.addr1)[
                    "safeTransferFrom(address,address,uint256,bytes)"
                  ](
                    this.addr1.address,
                    NFT_RECEIVER_CONTRACT.address,
                    this.addr1.expected.tokens[0],
                    "0x01",
                  ),
                ),
              ).to.equal("ReceiverRevert");
            });

            it("reverts if the receiver returns the wrong value", async function () {
              expect(
                await getCustomError(
                  NFT_CONTRACT.connect(this.addr1)[
                    "safeTransferFrom(address,address,uint256,bytes)"
                  ](
                    this.addr1.address,
                    NFT_RECEIVER_CONTRACT.address,
                    this.addr1.expected.tokens[0],
                    "0x02",
                  ),
                ),
              ).to.equal("TransferToNonERC721ReceiverImplementer");
            });
          });
        });
      });

      describe("burn", async function () {
        beforeEach(async function () {
          this.owner = this.addr2;
          this.spender = this.addr1;
          this.tokenIdToBurn = this.addr2.expected.tokens[0];
        });
        it("can burn account own token", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          await NFT_CONTRACT.connect(this.owner).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;
        });
        it("updates amount of burned tokens", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          await NFT_CONTRACT.connect(this.owner).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;
          const totalBurned = await NFT_CONTRACT.totalBurned();
          expect(totalBurned).to.equal(1);
        });
        it("updates account balance", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          expect(await NFT_CONTRACT.balanceOf(this.owner.address)).to.equal(4);
          await NFT_CONTRACT.connect(this.owner).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;
          expect(await NFT_CONTRACT.balanceOf(this.owner.address)).to.equal(3);
        });
        it("cannot transferFrom a burned token", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          await NFT_CONTRACT.connect(this.owner).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.owner).transferFrom(
                this.owner.address,
                this.spender.address,
                this.tokenIdToBurn,
              ),
            ),
          ).to.equal("OwnerQueryForNonexistentToken");
        });
        it("cannot burn a token owned by another if not approved", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.spender).burn(this.tokenIdToBurn),
            ),
          ).to.equal("TransferCallerNotOwnerNorApproved");
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
        });
        it("can burn a token owned by another if approved", async function () {
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.true;
          await NFT_CONTRACT.connect(this.owner).approve(
            this.spender.address,
            this.tokenIdToBurn,
          );
          const approval = await NFT_CONTRACT.getApproved(this.tokenIdToBurn);
          expect(approval).to.equal(this.spender.address);
          await NFT_CONTRACT.connect(this.spender).burn(this.tokenIdToBurn);
          expect(await NFT_CONTRACT.exists(this.tokenIdToBurn)).to.be.false;
        });
      });
    });

    context("test mint functionality", function () {
      beforeEach(async function () {
        const [owner, addr1] = await ethers.getSigners();
        this.owner = owner;
        this.addr1 = addr1;
      });

      const testSuccessfulMint = function (
        quantity: number,
        mintForContract = true,
      ) {
        beforeEach(async function () {
          this.minter = mintForContract ? NFT_RECEIVER_CONTRACT : this.addr1;

          this.balanceBefore = (
            await NFT_CONTRACT.balanceOf(this.minter.address)
          ).toNumber();

          this.mintTx = await NFT_CONTRACT.mintTickets(
            this.minter.address,
            quantity,
          );
        });

        it("changes ownership", async function () {
          for (let tokenId = 0; tokenId < quantity; tokenId++) {
            expect(await NFT_CONTRACT.ownerOf(tokenId)).to.equal(
              this.minter.address,
            );
          }
        });

        it("emits a Transfer event", async function () {
          for (let tokenId = 0; tokenId < quantity; tokenId++) {
            await expect(this.mintTx)
              .to.emit(NFT_CONTRACT, "Transfer")
              .withArgs(BYTES_ZERO, this.minter.address, tokenId);
          }
        });

        it("adjusts owners balances", async function () {
          expect(await NFT_CONTRACT.balanceOf(this.minter.address)).to.be.equal(
            this.balanceBefore + quantity,
          );
        });
      };

      context("successful mints", function () {
        context("mint", function () {
          context("for contract", function () {
            describe("single token", function () {
              testSuccessfulMint(1);
            });

            describe("multiple tokens", function () {
              testSuccessfulMint(5);
            });

            it("does not revert for non-receivers", async function () {
              const nonReceiver = NFT_CONTRACT;
              await NFT_CONTRACT.mintTickets(nonReceiver.address, 1);
              expect(await NFT_CONTRACT.ownerOf(0)).to.equal(
                nonReceiver.address,
              );
            });
          });

          context("for EOA", function () {
            describe("single token", function () {
              testSuccessfulMint(1, false);
            });

            describe("multiple tokens", function () {
              testSuccessfulMint(5, false);
            });
          });
        });
      });

      context("unsuccessful mints", function () {
        context("mint", function () {
          it("rejects mints to the zero address", async function () {
            expect(
              await getCustomError(NFT_CONTRACT.mintTickets(BYTES_ZERO, 1)),
            ).to.equal("MintToZeroAddress");
          });

          it("requires quantity to be greater than 0", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.mintTickets(this.owner.address, 0),
              ),
            ).to.equal("MintZeroQuantity");
          });
        });
      });
    });
  });
}
