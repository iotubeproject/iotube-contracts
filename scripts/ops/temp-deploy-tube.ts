import * as fs from "fs";
import { ethers, network, upgrades } from "hardhat"
import { LedgerV2 } from "../types/LedgerV2";
import { LordV2 } from "../types/LordV2";

async function main() {
  const [deployer] = await ethers.getSigners()
  const deployments = JSON.parse(fs.readFileSync(`./deployments/${network.name}.json`).toString())

  const Verifier = await ethers.getContractFactory("VerifierV2")
  const verifier = await Verifier.deploy()
  await verifier.deployed();
  console.log("Verifier deployed to:", verifier.address)
  deployments["verifier"] = verifier.address

  const ERC20Tube = await ethers.getContractFactory("ERC20Tube")
  const tube = await ERC20Tube.deploy(
    process.env.TUBE_ID, // tubeID
    deployments.ledger, // ledger
    deployments.lord, // lord
    deployments.verifier, // verifier
    deployments.tubeToken, // tubeToken
    deployer.address, // safe
    process.env.INIT_NONCE // initNonce
  )
  await tube.deployed();
  console.log("ERC20Tube deployed to:", tube.address)
  deployments["tube"] = tube.address

  // add operator
  const LedgerV2Factory = await ethers.getContractFactory("LedgerV2")
  const ledgerV2 = LedgerV2Factory.attach(deployments.ledger) as LedgerV2
  await ledgerV2.addOperator(tube.address)
  // add minter
  const LordV2Factory = await ethers.getContractFactory("LordV2")
  const lordV2 = LordV2Factory.attach(deployments.lord) as LordV2;
  await lordV2.addMinter(tube.address)

  const ERC20TubeRouter = await ethers.getContractFactory("ERC20TubeRouter")
  const router = await ERC20TubeRouter.deploy(tube.address)
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
