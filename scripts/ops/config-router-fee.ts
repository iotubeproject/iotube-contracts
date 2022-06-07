import * as fs from "fs";
import { ethers, network } from "hardhat"
import { ERC20TubeRouter } from "../../types/ERC20TubeRouter";

async function main() {
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const router = await ethers.getContractAt("ERC20TubeRouter", deployments.erc20TubeRouter) as ERC20TubeRouter

  console.log("add router fee...")
  const tx = await router.setRelayFee(
    10002, // tube id
    true, // active
    0 // fee
  )
  await tx.wait()
  console.log("add router fee successful.")
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
