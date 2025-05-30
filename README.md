The gas cost report can be found in the /test/ folder for each protocol.

Commands to run when creating a new hardhat project :

```shell
# Node ≥ 18 is recommended
node -v

# install (or update) Yarn / npm as you prefer
npm install --global npm
```

```shell
npm init --yes
npm install --save-dev hardhat          # core
npx hardhat init                        # choose “typescript” template
```

The directory should be like :

```shell
contracts/      hardhat.config.ts  scripts/   test/
```

You can install @openzeppelin, that will be used in the contracts :
```shell
npm install @openzeppelin/contracts
```

To compile the project :
```shell
npx hardhat compile
```

Run the npx node :
```shell
# window ① – start the in-memory Hardhat node
npx hardhat node
```
And deploy the contract :
```shell
# window ② – run the deploy script against that node
npx hardhat run --network localhost scripts/deploy.ts
```

In the test folder, after writing the test file, run :
```shell
npx hardhat test
```

To add some gas-report :
```shell
npm install --save-dev hardhat-gas-reporter
```

And modify the hardhat.config.ts as :

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
  solidity: "0.8.26",
  gasReporter: {
    enabled: true,
    currency: 'USD',
    outputFile: 'gas-report.txt',
    noColors: true,
    // coinmarketcap: process.env.COINMARKETCAP_API_KEY, // Optional: Get live gas prices
  }
};

export default config;
```
