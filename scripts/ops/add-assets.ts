import * as fs from "fs";
import { ethers, network } from "hardhat"
import { AssetRegistryV2 } from "../../types/AssetRegistryV2"

async function main() {
  const [deployer] = await ethers.getSigners()
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.registry.json`).toString())

  const registry = await ethers.getContractAt("AssetRegistryV2", deployments.assetRegistry) as AssetRegistryV2

  const tubes = [10002, 10003]
  const assets = [{
    id: 1,
    name: "cUSDT",
    addresses: [{
      tube: 10002,
      address: "0x32492aC61580e7E42317579D43aB7C921C9406c4"
    }, {
      tube: 10003,
      address: "0xfEC51632aF0CF8075e6F391b5F7dC33E28B375C4"
    }]
  },{
    id: 2,
    name: "cUSDC",
    addresses: [{
      tube: 10002,
      address: "0xC7c88394202C3CCe3d54557Ea60DDfDbB4a943Ac"
    }, {
      tube: 10003,
      address: "0x100Cb68fdEA6Fd2D1C3EC29C06Dd35A63f29547A"
    }]
  },{
    id: 3,
    name: "cBUSD",
    addresses: [{
      tube: 10002,
      address: "0x144220970AC713b32398D82db2F7947AD2eB01e2"
    }, {
      tube: 10003,
      address: "0x8D9EFF68052e8F9Ec89179D1402eB57Dbd6d5048"
    }]
  },]


  // add self as operator
  console.log(`Add admin as operator ...`)
  let tx = await registry.grant(deployer.address)
  await tx.wait()

  console.log(`Activate tube ...`)
  for (let i = 0; i < tubes.length; i++) {
    const tube = tubes[i];
    const tx = await registry.activateTube(tube)
    await tx.wait()
  }

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    console.log(`New asset ${asset.name} at ${asset.addresses[0].tube} ...`)
    let tx = await registry.newAsset(asset.addresses[0].tube, asset.addresses[0].address)
    await tx.wait()
    tx = await registry.activateAssetOnTube(asset.id, asset.addresses[0].tube)
    await tx.wait()
    for (let j = 1; j < asset.addresses.length; j++) {
      const address = asset.addresses[j];
      console.log(`Set ${asset.name} to ${address.tube} ...`)
      let tx = await registry.setAssetOnTube(asset.id, address.tube, address.address)
      await tx.wait()
      tx = await registry.activateAssetOnTube(asset.id, address.tube)
      await tx.wait()
    }

    console.log(`Activate asset ${asset.name}`)
    tx = await registry.activateAsset(asset.id)
    await tx.wait()
  }

  console.log(`Register assets completed`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
