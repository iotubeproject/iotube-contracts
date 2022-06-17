# iotube contracts

This repo is for iotube v6, multi-chain tokens. V0.2 is the version being worked on. New tokens introduced here will be CrossChain Tokens that can be wrap/unwrapped from multiple tokens from mutiple chains. 


## Develop

```
yarn
yarn test
```


## Remix Connect
```
npm install -g @remix-project/remixd
remixd -s .  --remix-ide https://remix.ethereum.org
```


## Deployment

```
export TUBE_ID=
export INIT_NONCE=
export SAFE=

yarn hardhat run scripts/000-deploy-base.ts
```

Add tokens
edit ```scripts/ops/create-crosschain-token.ts``` then
```
yarn hardhat run scripts/ops/create-crosschain-token.ts
```
