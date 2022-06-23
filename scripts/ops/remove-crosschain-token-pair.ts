import * as fs from "fs";
import { ethers, network } from "hardhat"
import { CrosschainERC20FactoryV2 } from "../../types/CrosschainERC20FactoryV2";
import { MinterDAO } from "../../types/MinterDAO";

async function main() {
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const CrosschainERC20FactoryV2Factory = await ethers.getContractFactory("CrosschainERC20FactoryV2")
  const factory = CrosschainERC20FactoryV2Factory.attach(deployments.crosschainERC20Factory) as CrosschainERC20FactoryV2

  const tokenName = "cUSDT"
  if (!deployments.crosschainToken[tokenName]) {
    console.log(`cToken ${tokenName} doesn't exists`)
    return
  }
  if(!deployments.pairs[tokenName] || deployments.pairs[tokenName].length === 0) {
    console.log(`no pairs for ${tokenName} found`)
    return
  }

  const minterdao = await ethers.getContractAt("MinterDAO", deployments.minterDAO) as MinterDAO
  for (let i = 0; i < deployments.pairs[tokenName].length; i++) {
    const pair = deployments.pairs[tokenName][i];
    console.log(`remove ${pair} ...`)
    const tx = await minterdao.removeMinter(pair, deployments.crosschainToken[tokenName])
    await tx.wait()
  }
  deployments.pairs[tokenName] = []
  
  fs.writeFileSync(`./deployments/${network.name}.json`, JSON.stringify(deployments, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
