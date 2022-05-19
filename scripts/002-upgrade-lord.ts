import * as fs from "fs"
import { ethers, upgrades, network } from "hardhat"

async function main() {
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const LordV2 = await ethers.getContractFactory("LordV2");
  const lord = await upgrades.upgradeProxy(deployments.lord, LordV2)
  console.log("lord upgraded");
}

main();