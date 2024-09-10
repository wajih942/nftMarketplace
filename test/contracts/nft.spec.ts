import { expect } from "chai";
import { Wallet, utils } from "ethers";
import {
  ContractTransferMock,
  TickieFactory,
  TickieNFT,
} from "../../typechain";
import {
  getCustomError,
  getTickiePermitSignature,
  getLatestBlockTimestamp,
  setNextBlockTimestamp,
} from "../helpers/HardhatHelper";
import {
  deployContractTransferMockContract,
  deployTickieFactoryContract,
  deployTickieNFTContract,
} from "../helpers/ProtocolHelper";
import { typedContract } from "../helpers/TypedContracts";

const { TickieNFT } = typedContract;

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
const BYTES_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const BYTES_42 =
  "0x0000000000000000000000000000000000000000000000000000000000000042";

let MOCK_TRANSFER_CONTRACT: ContractTransferMock;
let IMPLEMENTATION_CONTRACT: TickieNFT;
let NFT_CONTRACT: TickieNFT;
let NFT_FACTORY: TickieFactory;

export function shouldBehaveLikeTickieNft(): void {
  context("Tickie NFT", function () {
    beforeEach(async function () {
      this.admin = this.signers.deployer;
      this.minter = this.signers.deployer2;
      this.user = this.signers.user;
      this.user2 = this.signers.user2;

      IMPLEMENTATION_CONTRACT = await deployTickieNFTContract(this.admin);
      NFT_FACTORY = await deployTickieFactoryContract(
        this.admin,
        IMPLEMENTATION_CONTRACT.address,
      );
    });

    async function deployCollection(
      signer: Wallet,
      canTransfer: boolean = false,
      canTransferFromContracts: boolean = false,
      collectionName: string = "Collection A",
      baseURI: string = "www.example.com/mycollection/",
    ): Promise<TickieNFT> {
      await (
        await NFT_FACTORY.connect(signer).deployCollection(
          canTransfer,
          canTransferFromContracts,
          collectionName,
          baseURI,
        )
      ).wait();

      const nextCollectionId = await NFT_FACTORY.nextCollectionId();
      const proxyAddress = await NFT_FACTORY.collections(
        nextCollectionId.sub(1),
      );
      return TickieNFT(proxyAddress).connect(signer);
    }

    context("general tests", async function () {
      beforeEach(async function () {
        NFT_CONTRACT = await deployCollection(this.admin);
      });

      describe("initialization", async function () {
        it("cannot be reinitialized", async function () {
          expect(
            await getCustomError(
              NFT_CONTRACT.initialize(
                false,
                false,
                "Collection A",
                "www.example.com",
              ),
            ),
          ).to.equal("ContractAlreadyInitialized");
        });
      });

      describe("general storage", function () {
        it("is initialized", async function () {
          expect(await NFT_CONTRACT.isInitialized()).eq(true);
        });

        it("has empty minter", async function () {
          expect(await NFT_CONTRACT.minter()).eq(ADDRESS_ZERO);
        });
        it("has empty placeholder URI", async function () {
          expect(await NFT_CONTRACT.placeHolderTokenURI()).eq("");
        });
        it("has empty origin hash", async function () {
          expect(await NFT_CONTRACT.originHash()).eq(BYTES_ZERO);
        });
        it("zero value reveal timestamp", async function () {
          expect(await NFT_CONTRACT.revealTimestamp()).eq(0);
        });
        it("forbids transfer from wallets", async function () {
          expect(await NFT_CONTRACT.canTransfer()).eq(false);
        });
        it("forbids transfer from contracts", async function () {
          expect(await NFT_CONTRACT.canTransferFromContracts()).eq(false);
        });
      });

      describe("erc721 royalty", async function () {
        it("has empty initial data", async function () {
          const [feesTo, royaltyAmount] = await NFT_CONTRACT.royaltyInfo(
            42,
            utils.parseEther("1"),
          );

          expect(feesTo).eq(ADDRESS_ZERO);
          expect(royaltyAmount).eq(0);
        });

        it("can set royalty info", async function () {
          await NFT_CONTRACT.setRoyaltyConfig(this.admin.address, 1234);

          const [feesTo, royaltyAmount] = await NFT_CONTRACT.royaltyInfo(
            42,
            utils.parseEther("1"),
          );

          expect(feesTo).eq(this.admin.address);
          expect(royaltyAmount).eq(utils.parseEther("0.1234"));
        });
      });

      describe("authentication", async function () {
        context("owner", async function () {
          it("can change token URI", async function () {
            expect(await NFT_CONTRACT.baseURI()).to.equal(
              "www.example.com/mycollection/",
            );

            await NFT_CONTRACT.setBaseURI("www.example.com/tickieCollection/");

            expect(await NFT_CONTRACT.baseURI()).to.equal(
              "www.example.com/tickieCollection/",
            );
          });
          it("can change origin hash", async function () {
            await NFT_CONTRACT.setOriginHash(BYTES_42);

            expect(await NFT_CONTRACT.originHash()).to.equal(BYTES_42);
          });
        });
        context("minter", async function () {
          it("cannot change token URI", async function () {
            await NFT_CONTRACT.setMinter(this.minter.address);
            expect(await NFT_CONTRACT.minter()).to.equal(this.minter.address);
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.minter).setBaseURI(
                  "www.example.com/tickieCollection/",
                ),
              ),
            ).to.eq("NotOwner");
          });
          it("cannot change origin hash", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.minter).setOriginHash(BYTES_42),
              ),
            ).to.eq("NotOwner");
          });
        });
        context("common user", async function () {
          it("cannot change token URI", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.signers.user).setBaseURI(
                  "www.example.com/tickieCollection/",
                ),
              ),
            ).to.eq("NotOwner");
          });
          it("cannot change origin hash", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.signers.user).setOriginHash(BYTES_42),
              ),
            ).to.eq("NotOwner");
          });
        });
      });
    });

    context("with minted tokens", function () {
      beforeEach(async function () {
        NFT_CONTRACT = NFT_CONTRACT = await deployCollection(this.admin);

        await NFT_CONTRACT.mintMulti(
          [this.user.address, this.user2.address],
          [3, 2],
        );
        this.userTokens = [0, 1, 2];
        this.user2Tokens = [3, 4];
      });

      it("has correct token owners", async function () {
        expect(await NFT_CONTRACT.ownerOf(0)).to.equal(this.user.address);
        expect(await NFT_CONTRACT.ownerOf(1)).to.equal(this.user.address);
        expect(await NFT_CONTRACT.ownerOf(2)).to.equal(this.user.address);
        expect(await NFT_CONTRACT.ownerOf(3)).to.equal(this.user2.address);
        expect(await NFT_CONTRACT.ownerOf(4)).to.equal(this.user2.address);
      });

      it("has correct token URI", async function () {
        expect(await NFT_CONTRACT.tokenURI(0)).to.equal(
          "www.example.com/mycollection/0",
        );
        expect(await NFT_CONTRACT.tokenURI(1)).to.equal(
          "www.example.com/mycollection/1",
        );
        expect(await NFT_CONTRACT.tokenURI(2)).to.equal(
          "www.example.com/mycollection/2",
        );
        expect(await NFT_CONTRACT.tokenURI(3)).to.equal(
          "www.example.com/mycollection/3",
        );
        expect(await NFT_CONTRACT.tokenURI(4)).to.equal(
          "www.example.com/mycollection/4",
        );
      });

      describe("placeholder URI", () => {
        beforeEach(async function () {
          const latestBlockTimestamp = await getLatestBlockTimestamp();
          this.timeToReveal = 1200; // 20 minutes
          this.revealTimestamp = latestBlockTimestamp * this.timeToReveal;
          await NFT_CONTRACT.setPlaceholderURI(
            "www.example.com/placeholder/",
            this.revealTimestamp,
          );
        });

        it("has the token placeholder URI", async function () {
          expect(await NFT_CONTRACT.tokenURI(0)).to.equal(
            "www.example.com/placeholder/",
          );
        });
        it("still throws if token does not exist", async function () {
          expect(await getCustomError(NFT_CONTRACT.tokenURI(42))).to.eq(
            "URIQueryForNonexistentToken",
          );
        });
        it("can set empty placeholder to use base URI", async function () {
          await NFT_CONTRACT.setPlaceholderURI("", this.revealTimestamp);

          expect(await NFT_CONTRACT.tokenURI(3)).to.equal(
            "www.example.com/mycollection/3",
          );
        });
        it("shows the correct URI after reveal timestamp", async function () {
          const revealTimestamp = await NFT_CONTRACT.revealTimestamp();
          await setNextBlockTimestamp(revealTimestamp.add(1).toNumber());

          expect(await NFT_CONTRACT.tokenURI(3)).to.equal(
            "www.example.com/mycollection/3",
          );
        });

        describe("authentication", async function () {
          context("owner", async function () {
            it("can change placeholder URI", async function () {
              await NFT_CONTRACT.setPlaceholderURI(
                "www.example.com/placeholder/",
                0,
              );
            });
          });
          context("minter", async function () {
            it("cannot change placeholder URI", async function () {
              await NFT_CONTRACT.setMinter(this.minter.address);
              expect(await NFT_CONTRACT.minter()).to.equal(this.minter.address);
              expect(
                await getCustomError(
                  NFT_CONTRACT.connect(this.minter).setPlaceholderURI(
                    "www.example.com/placeholder/",
                    0,
                  ),
                ),
              ).to.eq("NotOwner");
            });
          });
          context("common user", async function () {
            it("cannot change token URI", async function () {
              expect(
                await getCustomError(
                  NFT_CONTRACT.connect(this.signers.user).setPlaceholderURI(
                    "www.example.com/placeholder/",
                    0,
                  ),
                ),
              ).to.eq("NotOwner");
            });
          });
        });
      });

      describe("regular tickets", async function () {
        it("can mint", async function () {
          await NFT_CONTRACT.mintTickets(this.user.address, 5);

          expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(
            this.userTokens.length + 5,
          );
          expect(await NFT_CONTRACT.totalSupply()).to.eq(10);
        });
        it("can mint multi", async function () {
          await NFT_CONTRACT.mintMulti(
            [this.user.address, this.user2.address],
            [5, 1],
          );

          expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(
            this.userTokens.length + 5,
          );
          expect(await NFT_CONTRACT.balanceOf(this.user2.address)).to.equal(
            this.user2Tokens.length + 1,
          );
          expect(await NFT_CONTRACT.totalSupply()).to.eq(11);
        });
        it("checks mint multi argument length", async function () {
          expect(
            await getCustomError(
              NFT_CONTRACT.mintMulti(
                [this.user.address, this.user2.address],
                [5, 2, 3],
              ),
            ),
          ).to.eq("ArgumentLengthMismatch");
        });
      });

      describe("invitation tickets", async function () {
        it("can mint invitation tickets", async function () {
          await NFT_CONTRACT.mintInvitationTicket(this.user.address, 2);

          expect(await NFT_CONTRACT.totalSupply()).to.eq(7);
          expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.eq(5);
        });
        it("updates correct start index", async function () {
          const startIndex = await NFT_CONTRACT.getStartIndex();
          const startIndexInvitations =
            await NFT_CONTRACT.getStartIndexInvitations();

          await NFT_CONTRACT.mintInvitationTicket(this.user.address, 2);

          expect(await NFT_CONTRACT.getStartIndex()).to.eq(startIndex);
          expect(await NFT_CONTRACT.getStartIndexInvitations()).to.eq(
            startIndexInvitations.add(2),
          );

          expect(
            await NFT_CONTRACT.tokenOfOwnerByIndex(
              this.user.address,
              this.userTokens.length,
            ),
          ).to.eq(startIndexInvitations);
          expect(
            await NFT_CONTRACT.tokenOfOwnerByIndex(
              this.user.address,
              this.userTokens.length + 1,
            ),
          ).to.eq(startIndexInvitations.add(1));
        });
      });

      describe("erc721 enumerable", async function () {
        it("has total supply", async function () {
          expect(await NFT_CONTRACT.totalSupply()).to.eq(5);
        });
        it("has tokens by index", async function () {
          expect(await NFT_CONTRACT.tokenByIndex(0)).to.eq(0);
          expect(await NFT_CONTRACT.tokenByIndex(1)).to.eq(1);
          expect(await NFT_CONTRACT.tokenByIndex(2)).to.eq(2);
          expect(await NFT_CONTRACT.tokenByIndex(3)).to.eq(3);
          expect(await NFT_CONTRACT.tokenByIndex(4)).to.eq(4);
        });
        it("has tokens of owner by index", async function () {
          expect(
            await NFT_CONTRACT.tokenOfOwnerByIndex(this.user.address, 0),
          ).to.eq(0);
          expect(
            await NFT_CONTRACT.tokenOfOwnerByIndex(this.user.address, 1),
          ).to.eq(1);
          expect(
            await NFT_CONTRACT.tokenOfOwnerByIndex(this.user.address, 2),
          ).to.eq(2);
          expect(
            await NFT_CONTRACT.tokenOfOwnerByIndex(this.user2.address, 0),
          ).to.eq(3);
          expect(
            await NFT_CONTRACT.tokenOfOwnerByIndex(this.user2.address, 1),
          ).to.eq(4);
        });
      });

      describe("erc2612 permit", async function () {
        beforeEach(async function () {
          await NFT_CONTRACT.setTransferAuthorisation(true, true);

          this.spenderWallet = this.signers.deployer2;
          this.fromWallet = this.user;
          this.from = this.user.address;
          this.to = this.user2.address;
          this.tokenId = this.userTokens[0];

          this.deadline =
            (await this.user.provider?.getBlock("latest"))?.timestamp + 30_000;
          this.signature = await getTickiePermitSignature(
            this.fromWallet,
            this.tokenId,
            this.spenderWallet.address,
            NFT_CONTRACT,
            this.deadline,
          );
        });

        it("can send with signature", async function () {
          await expect(
            await NFT_CONTRACT.connect(this.admin).transferFromWithPermit(
              this.from,
              this.to,
              this.tokenId,
              this.spenderWallet.address,
              this.deadline,
              this.signature.v,
              this.signature.r,
              this.signature.s,
            ),
          )
            .to.emit(NFT_CONTRACT, "Transfer")
            .withArgs(this.from, this.to, this.tokenId);

          expect(await NFT_CONTRACT.ownerOf(this.tokenId)).to.eq(this.to);
        });
        it("cannot reuse signature", async function () {
          for (let i = 0; i < 2; i++) {
            const getTx = () =>
              NFT_CONTRACT.connect(this.admin).transferFromWithPermit(
                this.from,
                this.to,
                this.tokenId,
                this.spenderWallet.address,
                this.deadline,
                this.signature.v,
                this.signature.r,
                this.signature.s,
              );

            if (i === 0) {
              await expect(await getTx())
                .to.emit(NFT_CONTRACT, "Transfer")
                .withArgs(this.from, this.to, this.tokenId);

              expect(await NFT_CONTRACT.ownerOf(this.tokenId)).to.eq(this.to);
            } else {
              expect(await getCustomError(getTx())).to.eq("InvalidPermit");
            }
          }
        });
        it("cannot send with bad signature", async function () {
          const badR = this.signature.r.replace(this.signature.r[2], "1");
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.admin).transferFromWithPermit(
                this.from,
                this.to,
                this.tokenId,
                this.spenderWallet.address,
                this.deadline,
                this.signature.v,
                badR,
                this.signature.s,
              ),
            ),
          ).to.eq("InvalidPermit");
        });
        it("cannot send deprecated signature", async function () {
          await setNextBlockTimestamp(this.deadline + 1);
          expect(
            await getCustomError(
              NFT_CONTRACT.connect(this.admin).transferFromWithPermit(
                this.from,
                this.to,
                this.tokenId,
                this.spenderWallet.address,
                this.deadline,
                this.signature.v,
                this.signature.r,
                this.signature.s,
              ),
            ),
          ).to.eq("ERC2612ExpiredPermitDeadline");
        });
      });

      describe("transfer authorisations", async function () {
        beforeEach(async function () {
          this.fromWallet = this.user;
          this.from = this.user.address;
          this.to = this.user2.address;
          this.tokenId = this.userTokens[0];
          this.tokenId2 = this.userTokens[1];

          MOCK_TRANSFER_CONTRACT = await deployContractTransferMockContract(
            this.admin,
          );

          await NFT_CONTRACT.connect(this.fromWallet).approve(
            MOCK_TRANSFER_CONTRACT.address,
            this.tokenId,
          );
          await NFT_CONTRACT.connect(this.fromWallet).approve(
            MOCK_TRANSFER_CONTRACT.address,
            this.tokenId2,
          );
        });

        async function checkTransfer(
          signer: Wallet,
          from: string,
          to: string,
          tokenId: number,
          shouldSucceed: boolean,
          senderType: "eoa" | "contract",
        ) {
          const getTx = () =>
            senderType === "eoa"
              ? NFT_CONTRACT.connect(signer).transferFrom(from, to, tokenId)
              : MOCK_TRANSFER_CONTRACT.contractTransfer(
                  NFT_CONTRACT.address,
                  from,
                  to,
                  tokenId,
                );

          if (shouldSucceed) {
            await getTx();
          } else {
            const expectError =
              senderType === "eoa"
                ? "TransfersCurrentlyUnauthorized"
                : "ContractTransfersCurrentlyUnauthorized";
            expect(await getCustomError(getTx())).to.eq(expectError);
          }
        }

        it("can block all transfers", async function () {
          expect(await NFT_CONTRACT.canTransfer()).to.eq(false);
          expect(await NFT_CONTRACT.canTransferFromContracts()).to.eq(false);
          await checkTransfer(
            this.fromWallet,
            this.from,
            this.to,
            this.tokenId,
            false,
            "eoa",
          );
          await checkTransfer(
            this.fromWallet,
            this.from,
            this.to,
            this.tokenId2,
            false,
            "contract",
          );
        });
        it("can authorize transfers from wallets", async function () {
          await NFT_CONTRACT.setTransferAuthorisation(true, false);
          await checkTransfer(
            this.fromWallet,
            this.from,
            this.to,
            this.tokenId,
            true,
            "eoa",
          );
          await checkTransfer(
            this.fromWallet,
            this.from,
            this.to,
            this.tokenId2,
            false,
            "contract",
          );
        });
        it("can authorize transfers from contracts", async function () {
          await NFT_CONTRACT.setTransferAuthorisation(true, true);
          await checkTransfer(
            this.fromWallet,
            this.from,
            this.to,
            this.tokenId,
            true,
            "eoa",
          );
          await checkTransfer(
            this.fromWallet,
            this.from,
            this.to,
            this.tokenId2,
            true,
            "contract",
          );
        });
        it("cannot only authorize transfers from contracts", async function () {
          expect(
            await getCustomError(
              NFT_CONTRACT.setTransferAuthorisation(false, true),
            ),
          ).to.eq("CannotAllowTransferFromContractsOnly");
        });
      });

      describe("token management", async function () {
        describe("refund tickets", async function () {
          it("refunds tokens", async function () {
            await NFT_CONTRACT.refundTickets([
              this.userTokens[2],
              this.user2Tokens[0],
            ]);

            expect(await NFT_CONTRACT.totalSupply()).to.eq(3);
            expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(2);
            expect(await NFT_CONTRACT.balanceOf(this.user2.address)).to.equal(
              1,
            );
          });
          it("keeps same start index", async function () {
            const startIndex = await NFT_CONTRACT.getStartIndex();
            await NFT_CONTRACT.refundTickets([
              this.userTokens[2],
              this.user2Tokens[0],
            ]);
            expect(await NFT_CONTRACT.getStartIndex()).to.eq(startIndex);
          });
          it("keeps same start index", async function () {
            const startIndex = await NFT_CONTRACT.getStartIndex();
            await NFT_CONTRACT.refundTickets([
              this.userTokens[2],
              this.user2Tokens[0],
            ]);
            expect(await NFT_CONTRACT.getStartIndex()).to.eq(startIndex);
          });
        });
        describe("save tickets", async function () {
          it("saves tokens", async function () {
            await NFT_CONTRACT.saveTickets(
              [this.userTokens[2]],
              this.user2.address,
            );

            expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(2);
            expect(await NFT_CONTRACT.balanceOf(this.user2.address)).to.equal(
              3,
            );
            expect(await NFT_CONTRACT.ownerOf(this.userTokens[2])).to.eq(
              this.user2.address,
            );
          });
        });
      });

      describe("minter role", async function () {
        beforeEach(async function () {
          await NFT_CONTRACT.setMinter(this.minter.address);
          expect(await NFT_CONTRACT.minter()).to.equal(this.minter.address);
        });

        it("can mint tickets", async function () {
          await NFT_CONTRACT.connect(this.minter).mintTickets(
            this.user.address,
            10,
          );
          expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(13);
        });
        it("can mint multiple tickets", async function () {
          await NFT_CONTRACT.connect(this.minter).mintMulti(
            [this.user.address, this.user2.address],
            [10, 10],
          );
          expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(13);
          expect(await NFT_CONTRACT.balanceOf(this.user2.address)).to.equal(12);
        });
        it("can mint invitations", async function () {
          await NFT_CONTRACT.connect(this.minter).mintInvitationTicket(
            this.user.address,
            10,
          );
          expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(13);
        });
        it("can refund tickets", async function () {
          await NFT_CONTRACT.connect(this.minter).refundTickets([2, 3]);

          expect(await NFT_CONTRACT.totalSupply()).to.eq(3);
          expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(2);
          expect(await NFT_CONTRACT.balanceOf(this.user2.address)).to.equal(1);
        });
        it("can save tokens", async function () {
          await NFT_CONTRACT.connect(this.minter).saveTickets(
            [this.userTokens[2]],
            this.user2.address,
          );

          expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(2);
          expect(await NFT_CONTRACT.balanceOf(this.user2.address)).to.equal(3);
          expect(await NFT_CONTRACT.ownerOf(this.userTokens[2])).to.eq(
            this.user2.address,
          );
        });
      });

      describe("admin functions", async function () {
        context("owner", async function () {
          it("can change minter role", async function () {
            expect(await NFT_CONTRACT.minter()).to.equal(ADDRESS_ZERO);

            await NFT_CONTRACT.setMinter(this.minter.address);

            expect(await NFT_CONTRACT.minter()).to.equal(this.minter.address);
          });

          it("emits event on setting minter", async function () {
            await expect(await NFT_CONTRACT.setMinter(this.minter.address))
              .to.emit(NFT_CONTRACT, "MinterUpdated")
              .withArgs(ADDRESS_ZERO, this.minter.address);
          });

          it("can change transfer authorization", async function () {
            expect(await NFT_CONTRACT.canTransfer()).to.eq(false);
            expect(await NFT_CONTRACT.canTransferFromContracts()).to.eq(false);

            await NFT_CONTRACT.setTransferAuthorisation(true, true);

            expect(await NFT_CONTRACT.canTransfer()).to.eq(true);
            expect(await NFT_CONTRACT.canTransferFromContracts()).to.eq(true);
          });

          it("emits event on transfer authorisation update", async function () {
            await expect(
              await NFT_CONTRACT.setTransferAuthorisation(true, false),
            )
              .to.emit(NFT_CONTRACT, "TransferAuthorisationsUpdated")
              .withArgs(true, false);
          });
        });

        context("minter", async function () {
          beforeEach(async function () {
            await NFT_CONTRACT.setMinter(this.minter.address);
            expect(await NFT_CONTRACT.minter()).to.equal(this.minter.address);
          });

          it("cannot change minter role", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.minter).setMinter(this.user.address),
              ),
            ).to.eq("NotOwner");
          });
          it("cannot change transfer authorization", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.minter).setTransferAuthorisation(
                  true,
                  true,
                ),
              ),
            ).to.eq("NotOwner");
          });
        });

        context("common user", async function () {
          it("cannot change minter role", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.user).setMinter(this.user.address),
              ),
            ).to.eq("NotOwner");
          });
          it("cannot change transfer authorization", async function () {
            expect(
              await getCustomError(
                NFT_CONTRACT.connect(this.user).setTransferAuthorisation(
                  true,
                  true,
                ),
              ),
            ).to.eq("NotOwner");
          });
        });
      });
    });

    context("implementation", async function () {
      it("cannot be initialized", async function () {
        expect(
          await getCustomError(
            IMPLEMENTATION_CONTRACT.initialize(
              true,
              true,
              "Collection A",
              "www.example.com/mycollection/",
            ),
          ),
        ).to.eq("OnlyDelegateCallAllowed");
      });
      it("can brick contract", async function () {
        await IMPLEMENTATION_CONTRACT.renounceOwnership();
        expect(await IMPLEMENTATION_CONTRACT.owner()).to.equal(ADDRESS_ZERO);
      });
      it("cannot be used after bricking", async function () {
        await IMPLEMENTATION_CONTRACT.renounceOwnership();

        expect(
          await getCustomError(
            IMPLEMENTATION_CONTRACT.mintTickets(this.user.address, 3),
          ),
        ).to.eq("NotOwnerOrMinter");
      });
      it("is still usable by proxy after bricking", async function () {
        await IMPLEMENTATION_CONTRACT.renounceOwnership();

        NFT_CONTRACT = await deployCollection(this.admin);
        await NFT_CONTRACT.mintTickets(this.user.address, 3);

        expect(await NFT_CONTRACT.balanceOf(this.user.address)).to.equal(3);
      });
    });
  });
}
