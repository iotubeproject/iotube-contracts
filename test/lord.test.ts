import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ethers } from "hardhat"
import { Lord } from "../types/Lord"
import { MockToken } from "../types/MockToken"
import { MockTokenNFT } from "../types/MockTokenNFT"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

describe("lord test", function () {
  const tokenID = 123456789
  let coToken: MockToken
  let coTokenNFT: MockTokenNFT
  let lord: Lord

  let owner: SignerWithAddress
  let holder1: SignerWithAddress
  let holder2: SignerWithAddress
  let holder3: SignerWithAddress
  let attacker: SignerWithAddress

  beforeEach(async function () {
    [owner, holder1, holder2, holder3, attacker] = await ethers.getSigners()

    const Lord = await ethers.getContractFactory("Lord")
    lord = (await Lord.connect(owner).deploy(
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS
    )) as Lord
    await lord.connect(owner).deployed()

    const MockToken = await ethers.getContractFactory("MockToken")
    coToken = (await MockToken.deploy("name", "symbol", 6)) as MockToken
    await coToken.deployed()
    await coToken.transferOwnership(lord.address)
    await coToken.connect(holder2).approve(lord.address, 1000000)

    const MockTokenNFT = await ethers.getContractFactory("MockTokenNFT")
    coTokenNFT = (await MockTokenNFT.deploy("name", "symbol")) as MockTokenNFT
    await coTokenNFT.deployed()
    await coTokenNFT.transferOwnership(lord.address)

    coTokenNFT.connect(holder3).setApprovalForAll(lord.address, true)
  })

  it("mint & burn token", async function () {
    expect(await coToken.balanceOf(holder2.address)).to.be.equal(0)
    await lord.connect(owner).mint(coToken.address, holder2.address, 1000)
    expect(await coToken.balanceOf(holder2.address)).to.be.equal(1000)

    await lord.connect(owner).burn(coToken.address, holder2.address, 200)
    expect(await coToken.balanceOf(holder2.address)).to.equal(800)
  })

  it("mint & burn tokenNFT", async function () {
    expect(await coTokenNFT.balanceOf(holder3.address)).to.equal(0)
    await lord.connect(owner).mintNFT(coTokenNFT.address, tokenID, holder3.address, "0x")
    expect(await coTokenNFT.balanceOf(holder3.address)).to.equal(1)

    await coTokenNFT.connect(holder3).approve(lord.address, tokenID)

    await lord.connect(owner).burnNFT(coTokenNFT.address, tokenID)
    expect(await coTokenNFT.balanceOf(holder3.address)).to.equal(0)
  })
})
