import * as fs from "fs";
import { ethers, network } from "hardhat"
import { ERC20Tube } from "../../types/ERC20Tube";

async function main() {
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const tube = await ethers.getContractAt("ERC20Tube", deployments.tube) as ERC20Tube

  console.log("add desination tube...")
  const tx = await tube.setDestinationTube(
    10002, // destination tube id
    0, // fee rate
    true // enable
  )
  await tx.wait()
  console.log("add desination tube successful.")
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
