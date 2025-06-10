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
```
At this point, you have two possibilities. Either you want to implement a new protocol, so you should run :

 ```bash
# Initialise a fresh Hardhat project (if starting from scratch)
mkdir my-proto && cd my-proto
npm init --yes
npm install --save-dev hardhat
npx hardhat init
```

Or, if you want to run one of the present protocol :

```bash
cd protox                           # x being the id of the protocol
npm init --yes
npm uninstall --save-dev hardhat-gas-reporter            # there are some dependecies error with this library, you need to uninstall it first before installing it again
npm install --save-dev hardhat
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
