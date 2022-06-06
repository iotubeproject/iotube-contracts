import * as fs from "fs";
import { ethers, network, upgrades } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const CrosschainERC20FactoryV2 = await ethers.getContractFactory("CrosschainERC20FactoryV2")
  const cTokenFactory = await CrosschainERC20FactoryV2.deploy(deployments.minterDAO)
  await cTokenFactory.deployed()
  console.log("CrosschainERC20FactoryV2 deployed to:", cTokenFactory.address)
  deployments["crosschainERC20Factory"] = cTokenFactory.address

  fs.writeFileSync(`./deployments/${network.name}.json`, JSON.stringify(deployments, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
