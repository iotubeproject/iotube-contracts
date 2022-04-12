import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { CrosschainERC20V2 } from "../types/CrosschainERC20V2"
import { CrosschainERC20FactoryV2 } from "../types/CrosschainERC20FactoryV2"


describe("crosschain erc20 factory v2", () => {
  let deployer: SignerWithAddress

  beforeEach(async function () {
    [deployer] = await ethers.getSigners()
  })

  it("checkout create token", async () => {
    const tokenFactory = await ethers.getContractFactory("CrosschainERC20V2")
    const template = await tokenFactory.deploy()

    const factoryFactory = await ethers.getContractFactory("CrosschainERC20FactoryV2")
    const factory = await factoryFactory.deploy(ethers.constants.AddressZero, template.address) as CrosschainERC20FactoryV2

    const createTokenTx = await factory.createForeignToken("Test Token", "TEST", 8)
    const { events } = await createTokenTx.wait()

    const cToken = tokenFactory.attach(events![0].args!.token) as CrosschainERC20V2

    expect(await cToken.name()).to.equal("Test Token");
    expect(await cToken.symbol()).to.equal("TEST");
    expect(await cToken.decimals()).to.equal(8);
    expect(await cToken.minter()).to.equal(ethers.constants.AddressZero);
  })
})
