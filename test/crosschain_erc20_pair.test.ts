import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { CrosschainERC20V2 } from "../types/CrosschainERC20V2"
import { CrosschainERC20V2Pair } from "../types/CrosschainERC20V2Pair"
import { MockToken } from "../types/MockToken"
import { MinterDAO } from "../types/MinterDAO"
import { ContractFactory } from "ethers"


describe("crosschain erc20 pair tests", () => {
  let cTokenFactory: ContractFactory
  let pairFactory: ContractFactory

  let minter: MinterDAO
  let cToken: CrosschainERC20V2
  let pair: CrosschainERC20V2Pair
  let token: MockToken

  let owner: SignerWithAddress
  let holder1: SignerWithAddress
  let holder2: SignerWithAddress
  let holder3: SignerWithAddress
  let attacker: SignerWithAddress

  beforeEach(async () => {
    [owner, holder1, holder2, holder3, attacker] = await ethers.getSigners()

    cTokenFactory = await ethers.getContractFactory("CrosschainERC20V2")
    pairFactory = await ethers.getContractFactory("CrosschainERC20V2Pair")

    const minerDaoFactory = await ethers.getContractFactory("MinterDAO")
    minter = await minerDaoFactory.deploy() as MinterDAO
    await minter.initialize(ethers.constants.AddressZero, ethers.constants.AddressZero)

    const tokenFactory = await ethers.getContractFactory("MockToken")
    token = await tokenFactory.deploy("Test Token", "Test", 8) as MockToken

    await token.mint(holder1.address, 100000000000)
    await token.mint(holder2.address, 100000000000)
    await token.mint(holder3.address, 100000000000)
  })

  describe("deposit & withdraw with same decimal", () => {
    beforeEach(async () => {
      cToken = await cTokenFactory.deploy(
        minter.address,
        "Crosschain Test Token",
        "cTest",
        (await token.decimals())
      ) as CrosschainERC20V2

      pair = await pairFactory.deploy(
        cToken.address,
        (await cToken.decimals()),
        token.address,
        (await token.decimals()),
        owner.address,
      ) as CrosschainERC20V2Pair

      await token.connect(holder1).approve(pair.address, 100000000000)
      await token.connect(holder2).approve(pair.address, 100000000000)
      await token.connect(holder3).approve(pair.address, 100000000000)
      await token.connect(attacker).approve(pair.address, 100000000000)

      await cToken.connect(holder1).approve(pair.address, 100000000000)
      await cToken.connect(holder2).approve(pair.address, 100000000000)
      await cToken.connect(holder3).approve(pair.address, 100000000000)
      await cToken.connect(attacker).approve(pair.address, 100000000000)
      await pair.connect(owner).increaseCredit(200000000000)
      expect(await pair.remainingCredit()).to.equals(200000000000)
    })

    it("no minter", async () => {
      expect(1).to.equals(await pair.scale())
      expect(0).to.equals(await pair.scaleType())
      expect(0).to.equals(await cToken.totalSupply())

      await expect(pair.connect(holder1).deposit(100000000)).to.be.revertedWith("not the minter")
      expect(0).to.equals(await cToken.totalSupply())
    })

    it("deposit", async () => {
      await minter.connect(owner).addMinter(pair.address, cToken.address)

      expect(0).to.equals(await cToken.totalSupply())
      await pair.connect(holder1).deposit(100000000)

      expect(100000000).to.equals(await cToken.totalSupply())
      expect(100000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(99900000000).to.equals(await token.balanceOf(holder1.address))
      expect(100000000).to.equals(await token.balanceOf(pair.address))

      await pair.connect(holder2).deposit(200000000)

      expect(300000000).to.equals(await cToken.totalSupply())
      expect(200000000).to.equals(await cToken.balanceOf(holder2.address))
      expect(99900000000).to.equals(await token.balanceOf(holder1.address))
      expect(99800000000).to.equals(await token.balanceOf(holder2.address))
      expect(300000000).to.equals(await token.balanceOf(pair.address))

      await pair.connect(holder3).depositTo(holder1.address, 300000000)
      expect(0).to.equals(await cToken.balanceOf(holder3.address))
      expect(400000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(600000000).to.equals(await cToken.totalSupply())

      await pair.connect(holder1).withdraw(100000000)
      expect(300000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(500000000).to.equals(await cToken.totalSupply())
      expect(100000000000).to.equals(await token.balanceOf(holder1.address))

      await pair.connect(holder1).withdrawTo(holder2.address, 100000000)
      expect(200000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(400000000).to.equals(await cToken.totalSupply())
      expect(100000000000).to.equals(await token.balanceOf(holder1.address))
      expect(99900000000).to.equals(await token.balanceOf(holder2.address))
    })

    it("no rounding deposit", async () => {
      await minter.connect(owner).addMinter(pair.address, cToken.address)

      expect(0).to.equals(await cToken.totalSupply())
      await pair.connect(holder1).depositNoRounding(100000000)

      expect(100000000).to.equals(await cToken.totalSupply())
      expect(100000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(99900000000).to.equals(await token.balanceOf(holder1.address))
      expect(100000000).to.equals(await token.balanceOf(pair.address))

      await pair.connect(holder2).depositNoRounding(200000000)

      expect(300000000).to.equals(await cToken.totalSupply())
      expect(200000000).to.equals(await cToken.balanceOf(holder2.address))
      expect(99900000000).to.equals(await token.balanceOf(holder1.address))
      expect(99800000000).to.equals(await token.balanceOf(holder2.address))
      expect(300000000).to.equals(await token.balanceOf(pair.address))

      await pair.connect(holder3).depositToNoRounding(holder1.address, 300000000)
      expect(0).to.equals(await cToken.balanceOf(holder3.address))
      expect(400000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(600000000).to.equals(await cToken.totalSupply())

      await pair.connect(holder1).withdrawNoRounding(100000000)
      expect(300000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(500000000).to.equals(await cToken.totalSupply())
      expect(100000000000).to.equals(await token.balanceOf(holder1.address))

      await pair.connect(holder1).withdrawToNoRounding(holder2.address, 100000000)
      expect(200000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(400000000).to.equals(await cToken.totalSupply())
      expect(100000000000).to.equals(await token.balanceOf(holder1.address))
      expect(99900000000).to.equals(await token.balanceOf(holder2.address))
    })
  })

  describe("deposit & withdraw with down decimal", () => {
    beforeEach(async () => {
      cToken = await cTokenFactory.deploy(
        minter.address,
        "Crosschain Test Token",
        "cTest",
        6
      ) as CrosschainERC20V2

      pair = await pairFactory.deploy(
        cToken.address,
        (await cToken.decimals()),
        token.address,
        (await token.decimals()),
        owner.address,
      ) as CrosschainERC20V2Pair

      await token.connect(holder1).approve(pair.address, 100000000000)
      await token.connect(holder2).approve(pair.address, 100000000000)
      await token.connect(holder3).approve(pair.address, 100000000000)
      await token.connect(attacker).approve(pair.address, 100000000000)

      await cToken.connect(holder1).approve(pair.address, 100000000000)
      await cToken.connect(holder2).approve(pair.address, 100000000000)
      await cToken.connect(holder3).approve(pair.address, 100000000000)
      await cToken.connect(attacker).approve(pair.address, 100000000000)

      await minter.connect(owner).addMinter(pair.address, cToken.address)
      await pair.connect(owner).increaseCredit(200000000000)
      expect(await pair.remainingCredit()).to.equals(200000000000)
    })

    describe("credit", () => {
      it("no permission", async() => {
        await expect(pair.connect(attacker).increaseCredit(100)).to.be.revertedWith("Ownable: caller is not the owner")
        expect(await pair.remainingCredit()).to.equals(200000000000)
        await expect(pair.connect(attacker).reduceCredit(100)).to.be.revertedWith("Ownable: caller is not the owner")
        expect(await pair.remainingCredit()).to.equals(200000000000)
      })
      it("failed to reduce credit", async() => {
        await expect(pair.connect(owner).reduceCredit(200000000001)).to.be.reverted
        expect(await pair.remainingCredit()).to.equals(200000000000)
      })
      it("reduce credit", async () => {
        await pair.connect(owner).reduceCredit(100000000000)
        expect(await pair.remainingCredit()).to.equals(100000000000)
      })
    })

    it("check basic", async () => {
      expect(100).to.equals(await pair.scale())
      expect(2).to.equals(await pair.scaleType())
      expect(0).to.equals(await cToken.totalSupply())
    })

    it("deposit", async () => {
      expect(0).to.equals(await cToken.totalSupply())
      await pair.connect(holder1).deposit(100000000)

      expect(1000000).to.equals(await cToken.totalSupply())
      expect(1000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(99900000000).to.equals(await token.balanceOf(holder1.address))
      expect(100000000).to.equals(await token.balanceOf(pair.address))

      await pair.connect(holder2).deposit(200000000)

      expect(3000000).to.equals(await cToken.totalSupply())
      expect(2000000).to.equals(await cToken.balanceOf(holder2.address))
      expect(99900000000).to.equals(await token.balanceOf(holder1.address))
      expect(99800000000).to.equals(await token.balanceOf(holder2.address))
      expect(300000000).to.equals(await token.balanceOf(pair.address))

      await pair.connect(holder3).depositTo(holder1.address, 300000099)
      expect(0).to.equals(await cToken.balanceOf(holder3.address))
      expect(4000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(6000000).to.equals(await cToken.totalSupply())
      expect(99700000000).to.equals(await token.balanceOf(holder3.address))
      expect(600000000).to.equals(await token.balanceOf(pair.address))

      await pair.connect(holder1).withdraw(1000000)
      expect(3000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(5000000).to.equals(await cToken.totalSupply())
      expect(100000000000).to.equals(await token.balanceOf(holder1.address))

      await pair.connect(holder1).withdrawTo(holder2.address, 1000000)
      expect(2000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(4000000).to.equals(await cToken.totalSupply())
      expect(100000000000).to.equals(await token.balanceOf(holder1.address))
      expect(99900000000).to.equals(await token.balanceOf(holder2.address))

      await expect(pair.connect(holder1).depositNoRounding(100000001)).to.be.revertedWith("no rounding")

      await pair.connect(holder1).withdrawNoRounding(1000000)
      expect(1000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(3000000).to.equals(await cToken.totalSupply())
    })
  })

  describe("deposit & withdraw with up decimal", () => {
    beforeEach(async () => {
      cToken = await cTokenFactory.deploy(
        minter.address,
        "Crosschain Test Token",
        "cTest",
        10
      ) as CrosschainERC20V2

      pair = await pairFactory.deploy(
        cToken.address,
        (await cToken.decimals()),
        token.address,
        (await token.decimals()),
        owner.address,
      ) as CrosschainERC20V2Pair

      await token.connect(holder1).approve(pair.address, 100000000000)
      await token.connect(holder2).approve(pair.address, 100000000000)
      await token.connect(holder3).approve(pair.address, 100000000000)
      await token.connect(attacker).approve(pair.address, 100000000000)

      await cToken.connect(holder1).approve(pair.address, 10000000000000)
      await cToken.connect(holder2).approve(pair.address, 10000000000000)
      await cToken.connect(holder3).approve(pair.address, 10000000000000)
      await cToken.connect(attacker).approve(pair.address, 10000000000000)

      await minter.connect(owner).addMinter(pair.address, cToken.address)
      await pair.connect(owner).increaseCredit(200000000000)
      expect(await pair.remainingCredit()).to.equals(200000000000)
    })

    it("check basic", async () => {
      expect(100).to.equals(await pair.scale())
      expect(1).to.equals(await pair.scaleType())
      expect(0).to.equals(await cToken.totalSupply())
    })

    it("deposit", async () => {
      expect(0).to.equals(await cToken.totalSupply())
      await pair.connect(holder1).deposit(100000000)

      expect(10000000000).to.equals(await cToken.totalSupply())
      expect(10000000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(99900000000).to.equals(await token.balanceOf(holder1.address))
      expect(100000000).to.equals(await token.balanceOf(pair.address))

      await pair.connect(holder2).deposit(200000000)

      expect(30000000000).to.equals(await cToken.totalSupply())
      expect(20000000000).to.equals(await cToken.balanceOf(holder2.address))
      expect(99900000000).to.equals(await token.balanceOf(holder1.address))
      expect(99800000000).to.equals(await token.balanceOf(holder2.address))
      expect(300000000).to.equals(await token.balanceOf(pair.address))

      await pair.connect(holder3).depositTo(holder1.address, 300000000)
      expect(0).to.equals(await cToken.balanceOf(holder3.address))
      expect(40000000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(60000000000).to.equals(await cToken.totalSupply())

      await pair.connect(holder1).withdraw(10000000000)
      expect(30000000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(50000000000).to.equals(await cToken.totalSupply())
      expect(100000000000).to.equals(await token.balanceOf(holder1.address))

      await pair.connect(holder1).withdrawTo(holder2.address, 10000000000)
      expect(20000000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(40000000000).to.equals(await cToken.totalSupply())
      expect(100000000000).to.equals(await token.balanceOf(holder1.address))
      expect(99900000000).to.equals(await token.balanceOf(holder2.address))

      await pair.connect(holder1).withdraw(10000000099)
      expect(10000000000).to.equals(await cToken.balanceOf(holder1.address))
      expect(30000000000).to.equals(await cToken.totalSupply())

      await expect(pair.connect(holder1).withdrawNoRounding(9999999901)).to.be.revertedWith("no rounding")
    })
  })
})