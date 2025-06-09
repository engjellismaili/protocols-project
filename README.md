<!-- The following commands were run on a Ubuntu 24.04 system, depending on your OS and version, commands might differ.

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
 -->

# Fair Data-Exchange for Certified Mail  
Smart‑contract prototypes & gas‑cost simulations

A research project exploring **fair data exchange** in the context of certified e‑mails.  
Each protocol variant (found in `/proto-*` folders) is implemented as a Hardhat project and accompanied by unit tests that collect detailed gas‑usage reports.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Ubuntu** | 24.04 (tested) | Commands may differ on other distros. |
| **Node.js** | ≥ 18 LTS | Required by Hardhat. |
| **npm** | Comes with Node | We update it below. |
| **Hardhat** | Latest | Installed per‑project. |

---

## 2. Quick‑start

```bash
# Update package lists
sudo apt update                     # optional but recommended

# Install Node.js
sudo apt install nodejs             # includes npm on Ubuntu

# Check versions
node -v                             # should print ≥ 18.x.y
npm -v                              # ensure npm is present

# (Optional) upgrade npm itself
npm install --global npm

# Initialise a fresh Hardhat project (if starting from scratch)
mkdir my-proto && cd my-proto
npm init --yes
npm install --save-dev hardhat
npx hardhat init
```

At this point the directory layout should resemble:

```
contracts/      hardhat.config.ts
scripts/        test/
```

---

## 3. Project‑level dependencies

```bash
# Solidity library: OpenZeppelin
npm install @openzeppelin/contracts
```

---

## 4. Compilation

Run **inside each `/proto-*` directory**:

```bash
npx hardhat compile
```

---

## 5. Local blockchain & deployment (optional)

```bash
# ① Start an in‑memory Hardhat node
npx hardhat node

# ② In another terminal, deploy contracts to that node
npx hardhat run --network localhost scripts/deploy.ts
```

---

## 6. Gas‑usage reporting

1. Install the reporter:

   ```bash
   npm install --save-dev hardhat-gas-reporter
   ```

2. Extend `hardhat.config.ts`:

   ```ts
   import { HardhatUserConfig } from "hardhat/config";
   import "@nomicfoundation/hardhat-toolbox";
   import "hardhat-gas-reporter";

   const config: HardhatUserConfig = {
     solidity: "0.8.26",
     gasReporter: {
       enabled: true,
       currency: "USD",
       outputFile: "gas-report.txt",
       noColors: true,
       // coinmarketcap: process.env.COINMARKETCAP_API_KEY, // live prices (optional)
     },
   };
   export default config;
   ```

3. Run the test suite to generate a **`gas-report.txt`** for each protocol:

   ```bash
   npx hardhat test
   ```

   The reports live under `./test/` for easy comparison.

---

## 7. Repository structure

```
/proto-A/               # Protocol variant A – own Hardhat project
├── contracts/          # Solidity sources
├── scripts/            # Deployment helpers
├── test/               # Mocha / Chai tests (+ gas reports)
└── hardhat.config.ts   # Per-proto build config
/proto-B/               # …repeat for each variant
README.md               # (this file)
```

---

## 8. License

Distributed under the MIT License unless noted otherwise in sub‑folders.

---