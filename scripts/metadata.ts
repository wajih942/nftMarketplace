import { utils } from "ethers";
import fs from "fs";

type RarityIndex = {
  [rarityName: string]: number;
};

type TickieNftMetadata = {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: [
    {
      trait_type: "Rarity";
      value: string;
    },
  ];
};

type DistributionIndex = {
  [rarityName: string]: number[];
};

// =============================== //
// ========== CONSTANTS ========== //
// =============================== //

// Maps rarity name to its value
const RARITY: RarityIndex = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
};
// The percent base used for computing and is equal to 100%
const PERCENT_BASE = 10_000;

// ============================ //
// ========== CONFIG ========== //
// ============================ //

const nbTickets: number = 3000;

// This defined the amount of non-common tokens per PERCENT_BASE tokens
//
// Common rarity is ignored since it is used to fill remaining tokens to allocate
//
// For example:
// if PERCENT_BASE = 10_000 and the RARE rate is 500
// then 5% of tokens will have that rarity
//
const rarityOccurence: RarityIndex = {
  UNCOMMON: 1000,
  RARE: 100,
  EPIC: 50,
  LEGENDARY: 10,
};

// This defines the distribution of the tokens withing the collection sequence
// Each index represents a range of tokens, if there are 4 ranges then a range is 25% of the collection
// Each number in the range is the proportion of that token rarity within the range
//
// Common rarity is ignored since it is used to fill remaining tokens to allocate
// Each rarity must have a distribution equal to PERCENT_BASE
// All rarity arrays must have the same length
//
// For example:
// if PERCENT_BASE = 10_000 and UNCOMMON[0] = 500 and number of ranges = 4
// then 5% of all UNCOMMON tokens will be within the first 25% of the collection's tokens
//
const desiredDistribution: DistributionIndex = {
  UNCOMMON: [500, 1500, 2000, 6000],
  RARE: [500, 1500, 2000, 6000],
  EPIC: [500, 1500, 2000, 6000],
  LEGENDARY: [500, 1500, 2000, 6000],
};

// ============================ //
// ========== HELPER ========== //
// ============================ //

function checkDistribution(distribution: DistributionIndex) {
  Object.values(distribution).reduce((acc: number | undefined, amounts) => {
    const sumAmounts = amounts.reduce((acc, amount) => acc + amount, 0);
    if (sumAmounts !== PERCENT_BASE)
      throw Error("Sum of rarity distribution must be equal to PERCENT_BASE");

    if (acc === undefined) {
      acc ??= amounts.length;
    } else {
      if (acc !== amounts.length)
        throw Error("All rarities must have same number of ranges");
    }
    if (acc < 1) throw Error("Requires at least one range");
    return acc;
  }, undefined);
}

function checkExpected(occurence: RarityIndex, expectedSum: number) {
  const sumAmounts = Object.values(occurence).reduce(
    (acc, amount) => acc + amount,
    0,
  );
  if (sumAmounts !== expectedSum)
    throw Error("Sum of rarity occurence must be equal to nb of tickets");
}

function computeRarityAmounts(amount: number, occurences: RarityIndex) {
  const nbExpected: RarityIndex = Object.entries(occurences).reduce(
    (acc, [rarity, occurence]) => ({
      ...acc,
      [rarity]: Math.floor((occurence / PERCENT_BASE) * amount),
    }),
    {},
  );
  nbExpected.COMMON =
    amount - Object.values(nbExpected).reduce((acc, val) => acc + val, 0);

  return nbExpected;
}

function shuffleTokenOrdering(tokens: number[]) {
  const randomness = 4.321;
  let currentIndex = tokens.length;

  // While there are remain elements to shuffle
  while (currentIndex != 0) {
    // Pick a remaining element
    const randomIndex =
      Math.floor(Math.random() * randomness * currentIndex) % tokens.length;
    currentIndex--;

    // And swap it with the current element
    [tokens[currentIndex], tokens[randomIndex]] = [
      tokens[randomIndex],
      tokens[currentIndex],
    ];
  }

  return tokens;
}

function makeDesiredTokenSequence(
  amount: number,
  distribution: DistributionIndex,
  rarityAmounts: RarityIndex,
) {
  const rarities = Object.keys(distribution);
  const nbOfRanges = distribution[rarities[0]].length;
  const rangeSize = Math.floor(amount / nbOfRanges);

  return new Array(nbOfRanges).fill("").reduce((acc: number[], _, i) => {
    const rangeArray = Object.values(rarities).reduce(
      (subAcc: number[], rarity) => {
        const rangeOccurence = distribution[rarity][i];
        const nbTokens = Math.floor(
          (rangeOccurence / PERCENT_BASE) * rarityAmounts[rarity],
        );
        const rarityValue = RARITY[rarity];

        return [...subAcc, ...new Array(nbTokens).fill(rarityValue)];
      },
      [],
    );

    const remainingTokens = rangeSize - rangeArray.length;

    // This will throw if the combination of amount of rarity tokens & the distribution in each range is impossible
    // For example:
    // 90% of tokens are UNCOMMON and 90% of the first range is UNCOMMON tokens while a range is 10% of the collection
    if (remainingTokens < 0) throw Error("Impossible distribution");

    const completeRange = [
      ...rangeArray,
      ...new Array(remainingTokens).fill(RARITY.COMMON),
    ];

    return [...acc, ...shuffleTokenOrdering(completeRange)];
  });
}

function makeCollectionMetaData(tokens: number[]): TickieNftMetadata[] {
  const rarities = Object.keys(RARITY);

  return Array.from(tokens).map(rarity => ({
    name: "Tickie NFT",
    description: "Match Brésil - Argentine du 11/12/2013",
    image: "https://tickie.io/nft/collection-1/3.png",
    external_url: "https://tickie.io/view/collection-1/3",
    attributes: [
      {
        trait_type: "Rarity",
        value: rarities[rarity - 1],
      },
    ],
  }));
}

// ========================== //
// ========== MAIN ========== //
// ========================== //

async function main(
  amount: number,
  occurences: RarityIndex,
  distribution: DistributionIndex,
) {
  console.log("\n=> Searching for provenance hash");

  checkDistribution(distribution);

  // Compute the amounts of each rarity
  const nbExpected = computeRarityAmounts(amount, occurences);
  checkExpected(nbExpected, amount);

  const tokenSequence = makeDesiredTokenSequence(
    amount,
    distribution,
    nbExpected,
  );
  console.log("=> Created sequence");
  // Generate all metadata files
  const metadata = makeCollectionMetaData(tokenSequence);

  // Compute the provenance hash
  const provenanceHash = utils.keccak256(
    utils.defaultAbiCoder.encode(["string"], [JSON.stringify(metadata)]),
  );
  console.log("=> Found provenance hash:", provenanceHash);

  // Folder creations & cleanups before writing
  if (!fs.existsSync("metadata/")) fs.mkdirSync("metadata/");
  if (!fs.existsSync("metadata/json/")) fs.mkdirSync("metadata/json/");
  for (const file of fs.readdirSync("metadata/json/")) {
    fs.unlinkSync(`metadata/json/${file}`);
  }

  // Write all token metadata and information
  for (const data of metadata) {
    const tokenId = metadata.indexOf(data);
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(`metadata/json/${tokenId}`, json);
  }
  fs.writeFileSync(
    "metadata/metadata.json",
    JSON.stringify(
      {
        provenanceHash,
      },
      null,
      2,
    ),
  );

  console.log("=> All files generated and written\n");
}

// This pattern enables use of async/await everywhere
// and properly handle errors.
main(nbTickets, rarityOccurence, desiredDistribution)
  .then(() => process.exit())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
