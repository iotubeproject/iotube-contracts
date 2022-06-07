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
    console.log("please create cToken first")
    return
  }
  const createTx = await factory.createCrosschainERC20Pair(
    deployments.crosschainToken[tokenName], // cUSDT
    6,
    "0x2407031BE476aCbc60C9269093B8Aa6B082AcFa3", // USDT_b
    18,
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

    const skipAddMinter = process.env.SKIP_ADD_MINTER || false
    if (!skipAddMinter) {
      console.log('add pair as token minter to MinterDAO')
      const minterdao = await ethers.getContractAt("MinterDAO", deployments.minterDAO) as MinterDAO
      const tx = await minterdao.addMinter(log.args.pair, deployments.crosschainToken[tokenName])
      await tx.wait()
    }
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
