import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { CrosschainERC20V2 } from "../types/CrosschainERC20V2"
import { CrosschainERC20V2Pair } from "../types/CrosschainERC20V2Pair"
import { CrosschainERC20FactoryV2 } from "../types/CrosschainERC20FactoryV2"
import { ContractFactory } from "ethers"

describe("crosschain erc20 factory v2", () => {
  let deployer: SignerWithAddress
  let minter: SignerWithAddress
  let tokenFactory: ContractFactory
  let pairFactory: ContractFactory
  let factory: CrosschainERC20FactoryV2

  beforeEach(async function () {
    [deployer, minter] = await ethers.getSigners()
    tokenFactory = await ethers.getContractFactory("CrosschainERC20V2")
    pairFactory = await ethers.getContractFactory("CrosschainERC20V2Pair")
    const factoryFactory = await ethers.getContractFactory("CrosschainERC20FactoryV2")
    factory = await factoryFactory.deploy(minter.address) as CrosschainERC20FactoryV2
  })

  it("checkout create token", async () => {
    const createTokenTx = await factory.createCrosschainERC20("Crosschain Test Token", "cTEST", 8)
    const { events } = await createTokenTx.wait()

    const cToken = tokenFactory.attach(events![0].args!.token) as CrosschainERC20V2

    expect(await cToken.name()).to.equal("Crosschain Test Token");
    expect(await cToken.symbol()).to.equal("cTEST");
    expect(await cToken.decimals()).to.equal(8);
    expect(await cToken.minterDAO()).to.equals(minter.address)
  })

  it("check create crosschain ERC20 pair",async () => {
    const token = await (await ethers.getContractFactory("MockToken")).deploy(
      "Test Token",
      "TEST",
      8
    )
    const createcTokenTx = await factory.createCrosschainERC20("Crosschain Test Token", "cTEST", 8)
    const { events } = await createcTokenTx.wait()
    const cTokenAddress = events![0].args!.token

    const createPairTx = await factory.createCrosschainERC20Pair(
      cTokenAddress,
      8,
      token.address,
      8
    )
    const receipt = await createPairTx.wait()

    const pair = pairFactory.attach(receipt.events![0].args!.pair) as CrosschainERC20V2Pair
    expect(await pair.token()).to.equal(token.address)
    expect(await pair.crosschainToken()).to.equal(cTokenAddress)
    expect(await pair.scale()).to.equals(1)
    expect(await pair.scaleType()).to.equals(0)
  })
})
