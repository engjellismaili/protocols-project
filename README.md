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
