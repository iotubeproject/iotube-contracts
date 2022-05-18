import * as fs from "fs";
import { ethers, network, upgrades } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  // const AssetRegistryV2 = await ethers.getContractFactory("AssetRegistryV2")
  // const assetRegistryV2 = await AssetRegistryV2.deploy()
  // await assetRegistryV2.deployed()
  // console.log("AssetRegistryV2 deployed to:", assetRegistryV2.address)
  // deployments["assetRegistry"] = assetRegistryV2.address

  const ValidatorRegistry = await ethers.getContractFactory("ValidatorRegistry")
  const validatorRegistry = await ValidatorRegistry.deploy()
  console.log("ValidatorRegistry deployed to:", validatorRegistry.address)
  deployments["validatorRegistry"] = validatorRegistry.address

  fs.writeFileSync(`./deployments/${network.name}.json`, JSON.stringify(deployments, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
