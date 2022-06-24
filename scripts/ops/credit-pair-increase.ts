import * as fs from "fs";
import { ethers, network } from "hardhat"
import { CrosschainERC20V2Pair } from "../../types/CrosschainERC20V2Pair"

async function main() {
  const pairAddr = process.env.PAIR
  const credit = process.env.CREDIT

  const pair = await ethers.getContractAt("CrosschainERC20V2Pair", pairAddr!) as CrosschainERC20V2Pair

  console.log(`Increase ${credit} credit for ${pairAddr} ...`)
  const tx = await pair.increaseCredit(credit!)
  await tx.wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
