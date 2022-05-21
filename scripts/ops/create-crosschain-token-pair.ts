import * as fs from "fs";
import { ethers, network, upgrades } from "hardhat"
import { CrosschainERC20FactoryV2 } from "../../types/CrosschainERC20FactoryV2";

async function main() {
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const CrosschainERC20FactoryV2Factory = await ethers.getContractFactory("CrosschainERC20FactoryV2")
  const factory = CrosschainERC20FactoryV2Factory.attach(deployments.crosschainERC20Factory) as CrosschainERC20FactoryV2

  const tokenName = "cUSDT"
  if (!deployments.crosschainToken[tokenName]) {
    console.log("please create cToken first")
    return
  }
  const createTx = await factory.createCrosschainERC20Pair(
    deployments.crosschainToken[tokenName], // cUSDT
    8,
    "0x0C3bf65c8D5ddf40cf4BDFa83982626c4436A051", // ioUSDT
    8,
  )
  const receipt = await createTx.wait()
  if (receipt.status === 1) {
    const log = CrosschainERC20FactoryV2Factory.interface.parseLog(receipt.logs[0])
    if(!deployments.pairs) {
      deployments.pairs = {}
    }
    if(!deployments.pairs[tokenName]) {
      deployments.pairs[tokenName] = []
    }
    deployments.pairs[tokenName].push(log.args.pair)
    console.log(`create crosschain token pair deployed at ${log.args.pair}`)
  } else {
    console.log("create crosschain token pair fail")
  }
  fs.writeFileSync(`./deployments/${network.name}.json`, JSON.stringify(deployments, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
