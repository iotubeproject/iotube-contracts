import * as fs from "fs";
import { ethers, network, upgrades } from "hardhat"
import { CrosschainERC20FactoryV2 } from "../../types/CrosschainERC20FactoryV2";

async function main() {
  const [deployer] = await ethers.getSigners()

  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const CrosschainERC20FactoryV2Factory = await ethers.getContractFactory("CrosschainERC20FactoryV2")
  const factory = CrosschainERC20FactoryV2Factory.attach(deployments.crosschainERC20Factory) as CrosschainERC20FactoryV2

  const tokenSymbol = "cBUSD";
  const tokenName = "Crosschain BUSD";
  const decimal = 18;

  const createTx = await factory.createCrosschainERC20(
    tokenName,
    tokenSymbol,
    decimal
  )
  const receipt = await createTx.wait()
  if (receipt.status === 1) {
    const log = CrosschainERC20FactoryV2Factory.interface.parseLog(receipt.logs[0])
    if(!deployments.crosschainToken) {
      deployments.crosschainToken = {}
    }
    deployments.crosschainToken[tokenSymbol] = log.args.token
    console.log(`create crosschain token deployed at ${log.args.token}`)
  } else {
    console.log("create crosschain token fail")
  }
  fs.writeFileSync(`./deployments/${network.name}.json`, JSON.stringify(deployments, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
