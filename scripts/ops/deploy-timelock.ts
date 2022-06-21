import * as fs from "fs"
import { ethers, network } from "hardhat"
import { CrosschainERC20FactoryV2 } from "../../types/CrosschainERC20FactoryV2"

async function main() {
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const [deployer] = await ethers.getSigners()
  const factory = await ethers.getContractFactory("Timelock")

  const timelock = await factory.deploy(
    deployer.address, // admin
    86400 // delay: one day
  )
  await timelock.deployed()

  console.log("Timelock deployed to:", timelock.address)
  deployments["timelock"] = timelock.address

  const crosschainERC20FactoryV2 = await ethers.getContractAt(
    "CrosschainERC20FactoryV2", deployments.crosschainERC20Factory
  ) as CrosschainERC20FactoryV2
  let tx = await crosschainERC20FactoryV2.transferOwnership(timelock.address)
  await tx.wait()
  console.log(`Set CrosschainERC20FactoryV2 owner to ${timelock.address}`) 

  fs.writeFileSync(`./deployments/${network.name}.json`, JSON.stringify(deployments, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
