import * as fs from "fs";
import { ethers, network, upgrades } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const ERC20TubeRouter = await ethers.getContractFactory("ERC20TubeRouter")
  const router = await ERC20TubeRouter.deploy(deployments.tube)
  await router.deployed();
  console.log("ERC20TubeRouter deployed to:", router.address)
  deployments["erc20TubeRouter"] = router.address

  fs.writeFileSync(`./deployments/${network.name}.json`, JSON.stringify(deployments, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
