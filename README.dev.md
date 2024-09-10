# TICKIE DEV DOCUMENTATION

## Metadata

### URL

The `tokenURI` function in your ERC721 contract should return an HTTP or IPFS URL. When queried, this URL should in turn return a JSON blob of data with the metadata for your token. As a reminder, a JSON blob should not contain any file extension like `.json`.

The URL for the metadata should end with the token ID, for example `http://www.example.com/foo/bar/3` for token with the ID `3`. In the case of invitations tickets, the token ID is shifted by `1 000 000` so that the 5th invitation token will have a token ID of `1000004`. The URL for invitation metadata should still end with the token ID.

### Content

The content of the metadata follows the the [official ERC721 metadata standard](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md).

These metadata should have the following type:

```ts
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
```

Here's an example of metadata for one of the NFT:

```ts
const nftMetadata: TickieNftMetadata = {
  name: "Tickie NFT",
  description: "Match Brésil - Argentine du 11/12/2013",
  image: "https://tickie.io/nft/collection-1/3.png",
  external_url: "https://tickie.io/view/collection-1/3",
  attributes: [
    {
      trait_type: "Rarity",
      value: "Epic",
    },
  ],
};
```

### Generate

To generate the collection ordering sequence, metadata and its origin hash you can run:

```shell
npm run metadata
```

This will generate all token metadata files in `metadata/json/`, these are the JSON blobs you should point to in the baseURI.
This will also save the rarity sequence and the origin hash in `metadata/hash`.

## Production

### Deployment

To deploy the NFT implementation contract and the NFT factory you must:

1. Set the following environment variables your `.env` file:

- Set the `DEPLOYER_PK` private key
- Set a provider, either set explicitly the `DEPLOYMENT_RPC_URL` or any of the `POLYGON_URL` and `MUMBAI_URL` backups

2. Run either of the deployment scripts:

For Hardhat (fork testing)

_This will use the TESTING_PK and the HARDHAT_FORK_TARGET_

```shell
npm run fork-deploy
```

For Mumbai

_This will use the DEPLOYER_PK and the DEPLOYMENT_RPC_URL (or backup)_

```shell
npm run mumbai-deploy
```

For Polygon

_This will use the DEPLOYER_PK and the DEPLOYMENT_RPC_URL (or backup)_

```shell
npm run matic-deploy
```

### Verification

1. Generate the flattened contracts with the following command:

```shell
npm run flat
```

2. Visit the dedicated chain explorer and use the flattened contracts located in `scripts/flat/`. Be sure to match the optimization runs with the value specified in the hardhat configuration file. To produce ABI encoded constructor arguments you can use [the following tool](https://abi.hashex.org/).
