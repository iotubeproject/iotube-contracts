import * as fs from "fs";
import { ethers, network } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()

  const deployment = {}

  const AssetRegistryV2 = await ethers.getContractFactory("AssetRegistryV2")
  const assetRegistryV2 = await AssetRegistryV2.deploy()
  await assetRegistryV2.deployed()
  console.log("AssetRegistryV2 deployed to:", assetRegistryV2.address)
  deployment["assetRegistry"] = assetRegistryV2.address

  const ValidatorRegistry = await ethers.getContractFactory("ValidatorRegistry")
  const validatorRegistry = await ValidatorRegistry.deploy()
  console.log("ValidatorRegistry deployed to:", validatorRegistry.address)
  deployment["validatorRegistry"] = validatorRegistry.address

  if(!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments")
  }
  fs.writeFileSync(`./deployments/${network.name}.registry.json`, JSON.stringify(deployment, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
