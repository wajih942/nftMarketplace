import { beforeEach } from "mocha";
import { resetFork } from "../helpers/HardhatHelper";
// Tests
import { shouldBehaveLikeFactory } from "./factory.spec";
import { shouldBehaveLikeTickieNft } from "./nft.spec";
import { shouldBehaveLikeErc721A } from "./erc721a.spec";

export function functionalTestsContracts(): void {
  beforeEach(async function () {
    this.retries(2);
    await resetFork();
  });

  describe("Core contracts", function () {
    shouldBehaveLikeFactory();
    shouldBehaveLikeTickieNft();
    shouldBehaveLikeErc721A();
  });
}
