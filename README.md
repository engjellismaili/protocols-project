The following commands were run on a Ubuntu 24.04 system, depending on your OS and version, commands might differ.

The gas cost report can be found in the /test/ folder for each protocol.

Before creating a hardhat project, you must download node, npm and hardhat

```shell
sudo apt update
sudo apt install nodejs

# Node ≥ 18 is recommended
node -v

sudo apt install npm

# update npm
npm install --global npm

npm init --yes
npm install --save-dev hardhat          
```

Then, in a new directory, run (the provided /proto directories were already initialized with hardhat): 

```shell
npx hardhat init                        
```

The directory should be like :

```shell
contracts/      hardhat.config.ts  scripts/   test/
```

You can install @openzeppelin, that will be used in the contracts :
```shell
npm install @openzeppelin/contracts
```

To compile the project (must be done in each /proto directory):
```shell
npx hardhat compile
```

Run the npx node (only used if you want to run the blockchain locally):
```shell
# window ① – start the in-memory Hardhat node
npx hardhat node
```
And deploy the contract (on the local blockchain, not useful if you just run the tests):
```shell
# window ② – run the deploy script against that node
npx hardhat run --network localhost scripts/deploy.ts
```

To add some gas-report for the tests:
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

In the test folder (for each proto), after writing the test file, run :
```shell
npx hardhat test
```

