import * as fs from "fs";
import { ethers, network, upgrades } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()

  const deployment = {}

  const MockToken = await ethers.getContractFactory("MockToken")
  let token = await MockToken.deploy("BUSD", "BUSD", 18)
  await token.deployed();
  console.log("BUSD deployed to:", token.address)
  token = await MockToken.deploy("USDT", "USDT", 6)
  await token.deployed();
  console.log("USDT deployed to:", token.address)
  token = await MockToken.deploy("USDC", "USDC", 6)
  await token.deployed();
  console.log("USDC deployed to:", token.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
