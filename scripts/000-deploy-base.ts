import * as fs from "fs";
import { ethers, network, upgrades } from "hardhat"

async function main() {
  const [deployer] = await ethers.getSigners()

  const deployment = {}

  const TubeToken = await ethers.getContractFactory("TubeToken")
  const tubeToken = await TubeToken.deploy()
  await tubeToken.deployed();
  console.log("TubeToken deployed to:", tubeToken.address)
  deployment["tubeToken"] = tubeToken.address

  const LordV2 = await ethers.getContractFactory("LordV2")
  const lordV2 = await upgrades.deployProxy(LordV2, [
    51840, // 3 days
  ]);
  await lordV2.deployed();
  console.log("LordV2 deployed to:", lordV2.address)
  deployment["lord"] = lordV2.address

  const AssetRegistryV2 = await ethers.getContractFactory("AssetRegistryV2")
  const assetRegistryV2 = await AssetRegistryV2.deploy()
  await assetRegistryV2.deployed();
  console.log("AssetRegistryV2 deployed to:", assetRegistryV2.address)
  deployment["assetRegistry"] = assetRegistryV2.address

  const LedgerV2 = await ethers.getContractFactory("LedgerV2")
  const ledgerV2 = await LedgerV2.deploy()
  await ledgerV2.deployed();
  console.log("LedgerV2 deployed to:", ledgerV2.address)
  deployment["ledger"] = ledgerV2.address

  const Verifier = await ethers.getContractFactory("Verifier")
  const verifier = await Verifier.deploy()
  await verifier.deployed();
  console.log("Verifier deployed to:", verifier.address)
  deployment["verifier"] = verifier.address
  
  const ERC20Tube = await ethers.getContractFactory("ERC20Tube")
  const tube = await ERC20Tube.deploy(
    0, // tubeID
    ledgerV2.address, // ledger
    lordV2.address, // lord
    verifier.address, // verifier
    tubeToken.address, // tubeToken
    deployer.address, // safe
    1 // initNonce
  )
  await tube.deployed();
  console.log("ERC20Tube deployed to:", tube.address)
  deployment["tube"] = tube.address

  const CrosschainERC20V2 = await ethers.getContractFactory("CrosschainERC20V2")
  const cToken = await CrosschainERC20V2.deploy()
  await cToken.deployed();
  console.log("cTokenTemplate deployed to:", cToken.address)
  deployment["cTokenTemplate"] = cToken.address

  const CrosschainERC20FactoryV2 = await ethers.getContractFactory("CrosschainERC20FactoryV2")
  const cTokenFactory = await CrosschainERC20FactoryV2.deploy(lordV2.address, cToken.address)
  await cTokenFactory.deployed();
  console.log("CrosschainERC20FactoryV2 deployed to:", cTokenFactory.address)
  deployment["cTokenFactory"] = cTokenFactory.address

  const TubeRouterV2 = await ethers.getContractFactory("TubeRouterV2")
  const tubeRouterV2 = await TubeRouterV2.deploy(tube.address)
  await tubeRouterV2.deployed();
  console.log("TubeRouterV2 deployed to:", tubeRouterV2.address)
  deployment["tubeRouter"] = tubeRouterV2.address

  if(!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments")
  }
  fs.writeFileSync(`./deployments/${network.name}.json`, JSON.stringify(deployment, null, 4))
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
