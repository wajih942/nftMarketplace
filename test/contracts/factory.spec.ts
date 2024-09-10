import { expect } from "chai";
import { BigNumber, Wallet } from "ethers";
import { TickieFactory, TickieNFT } from "../../typechain";
import { getCustomError } from "../helpers/HardhatHelper";
import {
  deployTickieFactoryContract,
  deployTickieNFTContract,
  deployNewImplementationMockContract,
} from "../helpers/ProtocolHelper";
import { typedContract } from "../helpers/TypedContracts";

const { TickieNFT } = typedContract;

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

let IMPLEMENTATION_CONTRACT: TickieNFT;
let NFT_CONTRACT: TickieNFT;
let NFT_FACTORY: TickieFactory;

export function shouldBehaveLikeFactory(): void {
  context("NFT Factory", function () {
    context("without implementation", async function () {
      beforeEach(async function () {
        NFT_FACTORY = await deployTickieFactoryContract(
          this.signers.deployer,
          ADDRESS_ZERO,
        );
      });

      describe("without collection", function () {
        it("has empty implementation", async function () {
          expect(await NFT_FACTORY.implementation()).eq(ADDRESS_ZERO);
        });

        it("reverts when deploying collection", async function () {
          expect(
            await getCustomError(
              NFT_FACTORY.deployCollection(
                true,
                true,
                "Tickie Test",
                "www.example.com",
              ),
            ),
          ).to.equal("NoImplementationSet");
        });
      });
    });

    context("with implementation", async function () {
      beforeEach(async function () {
        IMPLEMENTATION_CONTRACT = await deployTickieNFTContract(
          this.signers.deployer,
        );

        NFT_FACTORY = await deployTickieFactoryContract(
          this.signers.deployer,
          IMPLEMENTATION_CONTRACT.address,
        );
      });

      describe("general storage", function () {
        it("has implementation", async function () {
          expect(await NFT_FACTORY.implementation()).eq(
            IMPLEMENTATION_CONTRACT.address,
          );
        });
        it("has deployer", async function () {
          expect(await NFT_FACTORY.owner()).eq(this.signers.deployer.address);
        });
      });

      context("without collection", async function () {
        describe("collection data", function () {
          it("next collection ID", async function () {
            expect(await NFT_FACTORY.nextCollectionId()).eq(0);
          });

          it("has empty deployment addresses", async function () {
            expect(await NFT_FACTORY.collections(0)).eq(ADDRESS_ZERO);
          });

          it("has empty all deployment addresses array", async function () {
            expect((await NFT_FACTORY.allCollections()).length).eq(0);
          });

          it("reverts for data of non existent collection", async function () {
            expect(
              await getCustomError(NFT_FACTORY.collectionData(0)),
            ).to.equal("QueryForNonExistentCollection");
            expect(
              await getCustomError(NFT_FACTORY.collectionData(1)),
            ).to.equal("QueryForNonExistentCollection");
          });

          it("has empty all collections data array", async function () {
            expect((await NFT_FACTORY.allCollectionsData()).length).to.equal(0);
          });
        });
      });

      context("with collection", async function () {
        it("cannot deploy from user wallet", async function () {
          expect(
            await getCustomError(
              NFT_FACTORY.connect(this.signers.user).deployCollection(
                true,
                true,
                "Tickie Test 1",
                "www.example.com/collection1/",
              ),
            ),
          ).to.equal("NotOwnerOrDeployer");
        });

        beforeEach(async function () {
          await (
            await NFT_FACTORY.connect(this.signers.deployer).deployCollection(
              true,
              true,
              "Tickie Test 1",
              "www.example.com/collection1/",
            )
          ).wait();

          const proxyAddress = await NFT_FACTORY.collections(0);
          NFT_CONTRACT = TickieNFT(proxyAddress).connect(this.signers.deployer);
        });

        it("does not redeploy to same address", async function () {
          const firstCollectionAddress = NFT_CONTRACT.address;
          await (
            await NFT_FACTORY.connect(this.signers.deployer).deployCollection(
              true,
              true,
              "Tickie Test 1",
              "www.example.com/collection1/",
            )
          ).wait();
          const secondCollectionAddress = await NFT_FACTORY.collections(1);
          expect(firstCollectionAddress).to.not.equal(secondCollectionAddress);
        });

        describe("collection data", function () {
          it("has incremented next collection ID", async function () {
            expect(await NFT_FACTORY.nextCollectionId()).eq(1);
          });

          it("has correct deployment addresses", async function () {
            expect(await NFT_FACTORY.collections(0)).eq(NFT_CONTRACT.address);
          });

          it("has correct all deployment addresses array", async function () {
            expect((await NFT_FACTORY.allCollections()).length).eq(1);
            expect((await NFT_FACTORY.allCollections())[0]).eq(
              NFT_CONTRACT.address,
            );
          });

          it("does not throw for non existent collection", async function () {
            expect(
              async () => await NFT_FACTORY.collectionData(0),
            ).to.not.throw();
          });

          function checkCollectionData(
            data: TickieFactory.CollectionQueryStructOutput,
            expectOverride?: Partial<TickieFactory.CollectionQueryStructOutput>,
          ) {
            expect(data.id).to.equal(expectOverride?.id ?? 0);
            expect(data.name).to.equal(expectOverride?.name ?? "Tickie Test 1");
            expect(data.symbol).to.equal(
              expectOverride?.symbol ?? "TICKIE NFT",
            );
            expect(data.minter).to.equal(
              expectOverride?.minter ?? ADDRESS_ZERO,
            );
            expect(data.amountTicketsMinted).to.equal(
              expectOverride?.amountTicketsMinted ?? 0,
            );
            expect(data.amountInvitationsMinted).to.equal(
              expectOverride?.amountInvitationsMinted ?? 0,
            );
            expect(data.amountBurned).to.equal(
              expectOverride?.amountBurned ?? 0,
            );
            expect(data.deployedAt).to.equal(
              expectOverride?.deployedAt ?? NFT_CONTRACT.address,
            );
            expect(data.uri).to.equal(
              expectOverride?.uri ?? "www.example.com/collection1/",
            );
          }

          it("return data for collection", async function () {
            checkCollectionData(await NFT_FACTORY.collectionData(0));
          });

          it("return data from all collections array", async function () {
            checkCollectionData((await NFT_FACTORY.allCollectionsData())[0]);
          });

          it("return data for collection after activity", async function () {
            checkCollectionData(await NFT_FACTORY.collectionData(0));
          });

          it("return data from all collections array after activity", async function () {
            checkCollectionData((await NFT_FACTORY.allCollectionsData())[0]);
          });

          it("takes activity into account for collection data", async function () {
            await NFT_CONTRACT.mintTickets(this.signers.user.address, 5);
            await NFT_CONTRACT.mintInvitationTicket(
              this.signers.user.address,
              3,
            );
            await NFT_CONTRACT.refundTickets([1, 1000001]);
            await NFT_CONTRACT.setBaseURI("www.example.com/coll-1/");

            checkCollectionData(await NFT_FACTORY.collectionData(0), {
              amountTicketsMinted: BigNumber.from(5),
              amountInvitationsMinted: BigNumber.from(3),
              amountBurned: BigNumber.from(2),
              uri: "www.example.com/coll-1/",
            });
          });
        });

        async function updateImplementation(
          implementationSigner: Wallet,
          changeSigner?: Wallet,
        ) {
          const newImplementation = await deployNewImplementationMockContract(
            implementationSigner,
          );
          const updateTxPromise = NFT_FACTORY.connect(
            changeSigner ?? implementationSigner,
          ).changeImplementation(newImplementation.address);

          return {
            newImplementation,
            updateTxPromise,
          };
        }

        context("events", function () {
          it("emits on implementation change", async function () {
            const { newImplementation, updateTxPromise } =
              await updateImplementation(this.signers.deployer);

            await expect(await updateTxPromise)
              .to.emit(NFT_FACTORY, "NewImplementation")
              .withArgs(newImplementation.address);
          });

          it("emits on implementation refresh", async function () {
            const { newImplementation, updateTxPromise } =
              await updateImplementation(this.signers.deployer);
            await updateTxPromise;

            const collectionAddress = await NFT_FACTORY.collections(0);
            const tx = await NFT_FACTORY.refreshImplementations([0]);

            await expect(tx)
              .to.emit(NFT_FACTORY, "ImplementationRefreshed")
              .withArgs(0, collectionAddress, newImplementation.address);
          });

          it("emits on collection creation", async function () {
            const nextCollectionId = await NFT_FACTORY.nextCollectionId();

            const tx = await NFT_FACTORY.connect(
              this.signers.deployer,
            ).deployCollection(
              true,
              true,
              "Tickie Test 3",
              "www.example.com/collection3",
            );

            const collectionAddress = await NFT_FACTORY.collections(
              nextCollectionId,
            );

            await expect(tx)
              .to.emit(NFT_FACTORY, "CollectionCreated")
              .withArgs(nextCollectionId, collectionAddress);
          });
        });

        context("admin functions", async function () {
          describe("owner", async function () {
            it("can change implementation", async function () {
              const { newImplementation, updateTxPromise } =
                await updateImplementation(this.signers.deployer);
              await updateTxPromise;

              expect(await NFT_FACTORY.implementation()).eq(
                newImplementation.address,
              );

              await (
                await NFT_FACTORY.connect(
                  this.signers.deployer,
                ).deployCollection(
                  true,
                  true,
                  "Tickie Test 2",
                  "www.example.com/collection2",
                )
              ).wait();

              const latestCollectionId = (
                await NFT_FACTORY.nextCollectionId()
              ).sub(1);
              const latestCollectionAddress = await NFT_FACTORY.collections(
                latestCollectionId,
              );
              const latestCollectionContract = TickieNFT(
                latestCollectionAddress,
              ).connect(this.signers.deployer);

              expect(await latestCollectionContract.placeHolderTokenURI()).eq(
                "I'm new",
              );
            });

            it("can refresh implementation", async function () {
              const { newImplementation, updateTxPromise } =
                await updateImplementation(this.signers.deployer);
              await updateTxPromise;

              expect(await NFT_FACTORY.implementation()).eq(
                newImplementation.address,
              );
              await NFT_FACTORY.refreshImplementations([0]);

              const collectionAddress = await NFT_FACTORY.collections(0);
              const collectionContract = TickieNFT(collectionAddress).connect(
                this.signers.deployer,
              );

              expect(await collectionContract.placeHolderTokenURI()).eq(
                "I'm new",
              );
            });

            it("can change deployer", async function () {
              await NFT_FACTORY.changeDeployer(this.signers.deployer2.address);

              expect(await NFT_FACTORY.deployer()).eq(
                this.signers.deployer2.address,
              );
            });
          });
          describe("deployer role", function () {
            it("can deploy a collection", async function () {
              await NFT_FACTORY.changeDeployer(this.signers.deployer2.address);

              expect(await NFT_FACTORY.deployer()).eq(
                this.signers.deployer2.address,
              );

              const nextCollectionIdBefore =
                await NFT_FACTORY.nextCollectionId();

              await (
                await NFT_FACTORY.connect(
                  this.signers.deployer2,
                ).deployCollection(
                  true,
                  true,
                  "Tickie Test 3",
                  "www.example.com/collection3",
                )
              ).wait();

              expect(await NFT_FACTORY.nextCollectionId()).eq(
                nextCollectionIdBefore.add(1),
              );
            });
            it("cannot change implementation", async function () {
              const { updateTxPromise } = await updateImplementation(
                this.signers.deployer,
                this.signers.deployer2,
              );

              expect(await getCustomError(updateTxPromise)).to.eq("NotOwner");
            });
            it("cannot refresh implementation", async function () {
              await updateImplementation(this.signers.deployer);

              expect(
                await getCustomError(
                  NFT_FACTORY.connect(
                    this.signers.deployer2,
                  ).refreshImplementations([0]),
                ),
              ).to.eq("NotOwner");
            });

            it("cannot change deployer", async function () {
              expect(
                await getCustomError(
                  NFT_FACTORY.connect(this.signers.deployer2).changeDeployer(
                    this.signers.deployer2.address,
                  ),
                ),
              ).to.eq("NotOwner");
            });
          });
          describe("common user", function () {
            it("cannot change implementation", async function () {
              const { updateTxPromise } = await updateImplementation(
                this.signers.deployer,
                this.signers.user,
              );

              expect(await getCustomError(updateTxPromise)).to.eq("NotOwner");
            });
            it("cannot refresh implementation", async function () {
              await updateImplementation(this.signers.deployer);

              expect(
                await getCustomError(
                  NFT_FACTORY.connect(this.signers.user).refreshImplementations(
                    [0],
                  ),
                ),
              ).to.eq("NotOwner");
            });

            it("cannot change deployer", async function () {
              expect(
                await getCustomError(
                  NFT_FACTORY.connect(this.signers.user).changeDeployer(
                    this.signers.user.address,
                  ),
                ),
              ).to.eq("NotOwner");
            });
          });
        });
      });
    });
  });
}
