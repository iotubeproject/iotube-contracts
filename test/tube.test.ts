import _ from "lodash"
import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ecsign, toBuffer, setLengthLeft } from "ethereumjs-util"
import privateKeyToAddress from "ethereum-private-key-to-address"

import { Lord } from "../types/Lord"
import { Ledger } from "../types/Ledger"
import { Verifier } from "../types/Verifier"
import { AssetRegistry } from "../types/AssetRegistry"
import { CrosschainERC20Factory } from "../types/CrosschainERC20Factory"
import { MockToken } from "../types/MockToken"
import { Tube } from "../types/Tube"
import { MockSafe } from "../types/MockSafe"
import { CrosschainERC20 } from "../types/CrosschainERC20"


const CHAIN_ID = 4690
const FOREIGN_CHAIN_ID = 1
const CHAIN_ID_A = 4689
const CHAIN_ID_B = 4690
const ZERO_THREE_SIGNATURES =
  "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"

const VALIDATOR_PRIVATE_KEYS = [
  "18259bcf8198b35f3c1e863dab2f1663d1fd0dbe91c13d1a994bee3026ce790f",
  "43626b973fa6d002d5ffc1b3a639d81f2ab4bd0dd4a209ae7f560d1d71d91e42",
  "5b60ef73cf995182d606c893544a0a15dc7d2c5b9f870952120649655ebb98c0",
]

const VALIDATOR_ADDRESSES = VALIDATOR_PRIVATE_KEYS.map((v) => privateKeyToAddress(v))

function sign(hash: string, privateKey: string) {
  const { r, s, v } = ecsign(Buffer.from(hash, "hex"), Buffer.from(privateKey, "hex"))
  const signature = Buffer.concat([setLengthLeft(r, 32), setLengthLeft(s, 32), toBuffer(v)])
  return signature.toString("hex")
}

describe("tube uint test", function () {
  let lord: Lord
  let ledger: Ledger
  let verifier: Verifier
  let assetRegistry: AssetRegistry
  let factory: CrosschainERC20Factory
  let tubeToken: MockToken
  let tube: Tube
  let coToken: MockToken
  let localToken: CrosschainERC20
  let foreignToken: CrosschainERC20

  let owner: SignerWithAddress
  let holder1: SignerWithAddress
  let holder2: SignerWithAddress
  let holder3: SignerWithAddress
  let attacker: SignerWithAddress
  let treasure: SignerWithAddress
  let safe: SignerWithAddress

  beforeEach(async function () {
    [owner, holder1, holder2, holder3, attacker, treasure, safe] = await ethers.getSigners()

    const LordFactory = await ethers.getContractFactory("Lord")
    lord = await LordFactory.deploy(ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero) as Lord
    await lord.deployed()

    const LedgerFactory = await ethers.getContractFactory("Ledger")
    ledger = await LedgerFactory.deploy() as Ledger
    await ledger.deployed()

    const VerifierFactory = await ethers.getContractFactory("Verifier")
    verifier = await VerifierFactory.deploy() as Verifier
    await verifier.deployed()

    const AssetRegistryFactory = await ethers.getContractFactory("AssetRegistry")
    assetRegistry = await AssetRegistryFactory.deploy() as AssetRegistry
    await assetRegistry.deployed()

    const CrosschainERC20FactoryFactory = await ethers.getContractFactory("CrosschainERC20Factory")
    factory = await CrosschainERC20FactoryFactory.deploy(lord.address) as CrosschainERC20Factory
    await factory.deployed()

    let tx = await assetRegistry.grant(owner.address)
    await tx.wait()

    const MockTokenFactory = await ethers.getContractFactory("MockToken")
    tubeToken = await MockTokenFactory.deploy("name", "symbol", 6) as MockToken
    await tubeToken.deployed()

    const TubeFactory = await ethers.getContractFactory("Tube")
    tube = await TubeFactory.deploy(CHAIN_ID, ledger.address, lord.address, verifier.address, tubeToken.address, treasure.address) as Tube
    await tube.deployed()

    tx = await lord.transferOwnership(tube.address)
    await tx.wait()

    tx = await ledger.transferOwnership(tube.address)
    await tx.wait()

    tx = await tube.pause()
    await tx.wait()

    tx = await tube.acceptOwnerships()
    await tx.wait()

    tx = await tube.unpause()
    await tx.wait()

    coToken = await MockTokenFactory.deploy("name", "symbol", 6) as MockToken
    await coToken.deployed()

    let ret = await factory.createLocalToken(coToken.address, "name", "symbol", 6)
    let receipt = await ret.wait()
    let event = _.find(receipt.events, (e: any) => e.event == "NewCrosschainERC20")
    let CrosschainERC20Factory = await ethers.getContractFactory("CrosschainERC20")
    localToken = CrosschainERC20Factory.attach(event.args[0]) as CrosschainERC20

    ret = await factory.createForeignToken("name", "symbol", 6)
    receipt = await ret.wait()
    event = _.find(receipt.events, (e: any) => e.event == "NewCrosschainERC20")
    CrosschainERC20Factory = await ethers.getContractFactory("CrosschainERC20")
    foreignToken = CrosschainERC20Factory.attach(event.args[0]) as CrosschainERC20

    tx = await assetRegistry.addOriginalAsset(FOREIGN_CHAIN_ID, foreignToken.address);
    let retval = await tx.wait()
    const assetID = await assetRegistry.assetID(FOREIGN_CHAIN_ID, foreignToken.address);
    tx = await assetRegistry.addAssetOnTube(assetID, CHAIN_ID, localToken.address);
    await tx.wait();
  })

  it("Verifier", async function () {
    await expect(verifier.addAll([VALIDATOR_ADDRESSES[0]]))
      .to.emit(verifier, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[0])

    let ret = await verifier.get(0, 1);
    expect(ret.count_).to.equal(1)

    await expect(verifier.removeAll([VALIDATOR_ADDRESSES[0]]))
      .to.emit(verifier, "ValidatorRemoved")
      .withArgs(VALIDATOR_ADDRESSES[0])

    ret = await verifier.get(0, 1);
    expect(ret.count_).to.equal(0)
  })

  describe("depositTo", function () {
    it("invalid recipient", async function () {
      await expect(tube.depositTo(CHAIN_ID, holder3.address, ethers.constants.AddressZero, 1000, "0x")).to.be.revertedWith(
        "invalid recipient",
      )
    })
  })

  describe("deposit", function () {
    it("invalid amount", async function () {
      await expect(tube.deposit(CHAIN_ID, localToken.address, 0, "0x")).to.be.revertedWith("invalid amount")
    })

    it("without fee", async function () {
      let tx = await tube.pause()
      await tx.wait()
      await tube.setFee(CHAIN_ID, 1000000)
      tx = await tube.unpause()
      await tx.wait()
      await expect(tube.deposit(CHAIN_ID, localToken.address, 1000, "0x")).to.be.revertedWith(
        "ERC20: insufficient allowance",
      )
    })

    it("success without fee", async function () {
      await expect(coToken.mint(owner.address, 1000000))
        .to.emit(coToken, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, 1000000)

      await coToken.approve(localToken.address, 1000000)

      await expect(localToken.deposit(1000000))
        .to.emit(coToken, "Transfer")
        .withArgs(owner.address, localToken.address, 1000000)

      await expect(localToken.approve(lord.address, 300000))
        .to.emit(localToken, "Approval")
        .withArgs(owner.address, lord.address, 300000)

      await expect(tube.deposit(CHAIN_ID, localToken.address, 300000, "0x"))
        .to.emit(tube, "Receipt")
        .withArgs(CHAIN_ID, localToken.address, 1, owner.address, owner.address, 300000, "0x", 0)

      expect(await localToken.balanceOf(owner.address)).to.equal(700000)
    })

    it("success with fee", async function () {
      const fee = 1000000
      let tx = await tube.pause()
      await tx.wait()
      tx = await tube.setFee(CHAIN_ID, fee)
      await tx.wait()
      tx = await tube.unpause()
      await tx.wait()

      await expect(coToken.mint(owner.address, 1000000))
        .to.emit(coToken, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, 1000000)

      await coToken.approve(localToken.address, 1000000)

      await expect(localToken.deposit(1000000))
        .to.emit(coToken, "Transfer")
        .withArgs(owner.address, localToken.address, 1000000)

      await expect(tubeToken.mint(owner.address, 3000000))
        .to.emit(tubeToken, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, 3000000)

      await expect(tubeToken.approve(tube.address, 1000000))
        .to.emit(tubeToken, "Approval")
        .withArgs(owner.address, tube.address, 1000000)

      await expect(localToken.approve(lord.address, 300000))
        .to.emit(localToken, "Approval")
        .withArgs(owner.address, lord.address, 300000)

      await expect(tube.deposit(CHAIN_ID, localToken.address, 300000, "0x"))
        .to.emit(tube, "Receipt")
        .withArgs(CHAIN_ID, localToken.address, 1, owner.address, owner.address, 300000, "0x", 1000000)

      expect(await tubeToken.balanceOf(owner.address)).to.equal(2000000)
      expect(await localToken.balanceOf(owner.address)).to.equal(700000)
    })
  })

  describe("withdraw", function () {
    beforeEach(async function () {
      await expect(verifier.addAll([VALIDATOR_ADDRESSES[0]]))
        .to.emit(verifier, "ValidatorAdded")
        .withArgs(VALIDATOR_ADDRESSES[0])

      await expect(verifier.addAll([VALIDATOR_ADDRESSES[1]]))
        .to.emit(verifier, "ValidatorAdded")
        .withArgs(VALIDATOR_ADDRESSES[1])

      await expect(verifier.addAll([VALIDATOR_ADDRESSES[2]]))
        .to.emit(verifier, "ValidatorAdded")
        .withArgs(VALIDATOR_ADDRESSES[2])
    })

    it("amount is 0", async function () {
      await expect(
        tube.withdraw(CHAIN_ID, 1, localToken.address,  holder1.address, 0, "0x", ZERO_THREE_SIGNATURES),
      ).to.be.revertedWith("amount is 0")
    })

    it("invalid recipient", async function () {
      await expect(
        tube.withdraw(CHAIN_ID, 1, localToken.address, ethers.constants.AddressZero, 1000, "0x", ZERO_THREE_SIGNATURES),
      ).to.be.revertedWith("invalid recipient")
    })

    it("invalid signature length", async function () {
      await expect(tube.withdraw(CHAIN_ID, 1, localToken.address, holder1.address, 1000, "0x", "0x00")).to.be.revertedWith(
        "invalid signature length",
      )
    })

    it("invalid validator", async function () {
      await expect(
        tube.withdraw(CHAIN_ID, 1, localToken.address, holder1.address, 1000, "0x", ZERO_THREE_SIGNATURES),
      ).to.be.revertedWith("invalid validator")
    })

    it("duplicate validators", async function () {
      const key = await tube.genKey(CHAIN_ID, 1, localToken.address, holder1.address, 1000, "0x")

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const signature = "0x" + s1 + s1

      await expect(tube.withdraw(CHAIN_ID, 1, localToken.address, holder1.address, 1000, "0x", signature)).to.be.revertedWith(
        "duplicate validator",
      )
    })

    it("insufficient validators", async function () {
      const key = await tube.genKey(CHAIN_ID, 1, foreignToken.address, holder1.address, 1000, "0x")

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const signature = "0x" + s1

      await expect(tube.withdraw(CHAIN_ID, 1, foreignToken.address, holder1.address, 1000, "0x", signature)).to.be.revertedWith(
        "insufficient validators",
      )
    })

    it("success", async function () {
      const key = await tube.genKey(CHAIN_ID, 1, foreignToken.address, holder1.address, 1000, "0x")

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
      const s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
      const signature = "0x" + s1 + s2 + s3

      await expect(tube.withdraw(CHAIN_ID, 1, foreignToken.address, holder1.address, 1000, "0x", signature))
        .to.emit(tube, "Settled")
        .withArgs(key, VALIDATOR_ADDRESSES, true)

      expect(await foreignToken.balanceOf(holder1.address)).to.equal(1000)
    })
  })

  describe("withdraw with data", function () {
    let safeRouter: MockSafe;
    beforeEach(async function () {
      await expect(verifier.addAll([VALIDATOR_ADDRESSES[0]]))
        .to.emit(verifier, "ValidatorAdded")
        .withArgs(VALIDATOR_ADDRESSES[0])

      await expect(verifier.addAll([VALIDATOR_ADDRESSES[1]]))
        .to.emit(verifier, "ValidatorAdded")
        .withArgs(VALIDATOR_ADDRESSES[1])

      await expect(verifier.addAll([VALIDATOR_ADDRESSES[2]]))
        .to.emit(verifier, "ValidatorAdded")
        .withArgs(VALIDATOR_ADDRESSES[2])

      const MockSafeFactory = await ethers.getContractFactory("MockSafe");
      safeRouter = await MockSafeFactory.deploy(safe.address) as MockSafe;
      await safeRouter.deployed();
    })

    it("fail", async function () {
      const amount = 999;
      const bytecode = "0x8340f549" + foreignToken.address.substring(2).padStart(64, "0") + holder1.address.substring(2).padStart(64, "0") + amount.toString(16).padStart(64, "0")
      const key = await tube.genKey(CHAIN_ID, 1, foreignToken.address, safeRouter.address, amount, bytecode)

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
      const s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
      const signature = "0x" + s1 + s2 + s3

      await expect(tube.withdraw(CHAIN_ID, 1, foreignToken.address, safeRouter.address, amount, bytecode, signature))
        .to.emit(tube, "Settled")
        .withArgs(key, VALIDATOR_ADDRESSES, false)

      expect(await foreignToken.balanceOf(safeRouter.address)).to.equal(amount)
      expect(await foreignToken.balanceOf(safe.address)).to.equal(0)
    })

    it("success", async function () {
      const amount = 1000;
      const bytecode = "0x8340f549" + foreignToken.address.substring(2).padStart(64, "0") + holder1.address.substring(2).padStart(64, "0") + amount.toString(16).padStart(64, "0")
      const key = await tube.genKey(CHAIN_ID, 1, foreignToken.address, safeRouter.address, amount, bytecode)

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
      const s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
      const signature = "0x" + s1 + s2 + s3

      await expect(tube.withdraw(CHAIN_ID, 1, foreignToken.address, safeRouter.address, amount, bytecode, signature))
        .to.emit(tube, "Settled")
        .withArgs(key, VALIDATOR_ADDRESSES, true)

      expect(await foreignToken.balanceOf(safeRouter.address)).to.equal(0)
      expect(await foreignToken.balanceOf(safe.address)).to.equal(amount)
      expect(await safeRouter.points(foreignToken.address, holder1.address)).to.equal(amount)
    })
  })

  /*
  describe("withdrawInBatch", function () {
    beforeEach(async function () {
      await expect(verifier.addAll([VALIDATOR_ADDRESSES[0]]))
        .to.emit(verifier, "ValidatorAdded")
        .withArgs(VALIDATOR_ADDRESSES[0])

      await expect(verifier.addAll([VALIDATOR_ADDRESSES[1]]))
        .to.emit(verifier, "ValidatorAdded")
        .withArgs(VALIDATOR_ADDRESSES[1])

      await expect(verifier.addAll([VALIDATOR_ADDRESSES[2]]))
        .to.emit(verifier, "ValidatorAdded")
        .withArgs(VALIDATOR_ADDRESSES[2])
    })

    it("invalid array length", async function () {
      await expect(tube.withdrawInBatch([], [], [], [], [], ZERO_THREE_SIGNATURES)).to.be.revertedWith(
        "invalid array length",
      )
    })

    it("invalid signature length", async function () {
      await expect(
        tube.withdrawInBatch([CHAIN_ID], [1], [foreignToken.address], [holder1.address], [100], "0x00"),
      ).to.be.revertedWith("invalid signature length")
    })

    it("invalid parameters", async function () {
      await expect(
        tube.withdrawInBatch([CHAIN_ID], [], [foreignToken.address], [holder1.address], [100], ZERO_THREE_SIGNATURES),
      ).to.be.revertedWith("invalid parameters")
    })

    it("amount is 0", async function () {
      await expect(
        tube.withdrawInBatch([CHAIN_ID], [1], [foreignToken.address], [holder1.address], [0], ZERO_THREE_SIGNATURES),
      ).to.be.revertedWith("amount is 0")
    })

    it("invalid recipient", async function () {
      await expect(
        tube.withdrawInBatch([CHAIN_ID], [1], [foreignToken.address], [ZERO_ADDRESS], [100], ZERO_THREE_SIGNATURES),
      ).to.be.revertedWith("invalid recipient")
    })

    it("invalid validator", async function () {
      await expect(
        tube.withdrawInBatch([CHAIN_ID],[1], [foreignToken.address], [holder1.address], [100], ZERO_THREE_SIGNATURES),
      ).to.be.revertedWith("invalid validator")
    })

    it("insufficient validators", async function () {
      const key1 = await tube.genKey(CHAIN_ID, 1, foreignToken.address, holder1.address, 1000, "0x")

      const key2 = await tube.genKey(CHAIN_ID, 2, foreignToken.address, holder2.address, 200, "0x")

      const key = await tube.concatKeys([key1, key2])

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const signature = "0x" + s1

      await expect(
        tube.withdrawInBatch(
          [CHAIN_ID, CHAIN_ID],
          [1, 2],
          [foreignToken.address, foreignToken.address],
          [holder1.address, holder2.address],
          [1000, 200],
          signature,
        ),
      ).to.be.revertedWith("insufficient validators")
    })

    it("duplicate validator", async function () {
      const key1 = await tube.genKey(CHAIN_ID, 1, foreignToken.address, holder1.address, 1000, "0x")

      const key2 = await tube.genKey(CHAIN_ID, 2, foreignToken.address, holder2.address, 200, "0x")

      const key = await tube.concatKeys([key1, key2])

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const signature = "0x" + s1 + s1

      await expect(
        tube.withdrawInBatch(
          [CHAIN_ID, CHAIN_ID],
          [1, 2],
          [foreignToken.address, foreignToken.address],
          [holder1.address, holder2.address],
          [1000, 200],
          signature,
        ),
      ).to.be.revertedWith("duplicate validator")
    })

    it("success", async function () {
      const key1 = await tube.genKey(CHAIN_ID, 1, foreignToken.address, holder1.address, 1000, "0x")

      const key2 = await tube.genKey(CHAIN_ID, 2, foreignToken.address, holder2.address, 200, "0x")

      const key = await tube.concatKeys([key1, key2])

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
      const s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
      const signature = "0x" + s1 + s2 + s3

      await expect(
        tube.withdrawInBatch(
          [CHAIN_ID, CHAIN_ID],
          [1, 2],
          [foreignToken.address, foreignToken.address],
          [holder1.address, holder2.address],
          [1000, 200],
          signature,
        ),
      )
        .to.emit(tube, "Settled")
        .withArgs(key1, VALIDATOR_ADDRESSES, true)
        .to.emit(tube, "Settled")
        .withArgs(key2, VALIDATOR_ADDRESSES, true)

      expect(await foreignToken.balanceOf(holder1.address)).to.equal(1000)
      expect(await foreignToken.balanceOf(holder2.address)).to.equal(200)
    })
  })
  */
})

describe("tube integrate test", function () {
  let lordA: Lord
  let ledgerA: Ledger
  let verifierA: Verifier
  let assetRegistryA: AssetRegistry
  let factoryA: CrosschainERC20Factory
  let tubeTokenA: MockToken
  let tubeA: Tube

  let lordB: Lord
  let ledgerB: Ledger
  let verifierB: Verifier
  let assetRegistryB: AssetRegistry
  let factoryB: CrosschainERC20Factory
  let tubeTokenB: MockToken
  let tubeB: Tube

  let coTokenA: MockToken
  let ceA: CrosschainERC20
  let ceB: CrosschainERC20

  let ownerA: SignerWithAddress
  let ownerB: SignerWithAddress
  let holder1: SignerWithAddress
  let holder2: SignerWithAddress
  let holder3: SignerWithAddress
  let attacker: SignerWithAddress
  let treasureA: SignerWithAddress
  let treasureB: SignerWithAddress

  beforeEach(async function () {
    [ownerA, ownerB, holder1, holder2, holder3, attacker, treasureA, treasureB] = await ethers.getSigners()

    const LordFactory = await ethers.getContractFactory("Lord")
    lordA = await LordFactory.connect(ownerA).deploy(ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero) as Lord
    await lordA.deployed()
    lordB = await LordFactory.connect(ownerB).deploy(ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero) as Lord
    await lordB.deployed()

    const LedgerFactory = await ethers.getContractFactory("Ledger")
    ledgerA = await LedgerFactory.connect(ownerA).deploy() as Ledger
    await ledgerA.deployed()
    ledgerB = await LedgerFactory.connect(ownerB).deploy() as Ledger
    await ledgerB.deployed()

    const VerifierFactory = await ethers.getContractFactory("Verifier")
    verifierA = await VerifierFactory.connect(ownerA).deploy() as Verifier
    await verifierA.deployed()
    verifierB = await VerifierFactory.connect(ownerB).deploy() as Verifier
    await verifierB.deployed()

    const AssetRegistryFactory = await ethers.getContractFactory("AssetRegistry")
    assetRegistryA = await AssetRegistryFactory.connect(ownerA).deploy() as AssetRegistry
    await assetRegistryA.deployed()

    const CrosschainERC20FactoryFactory = await ethers.getContractFactory("CrosschainERC20Factory")
    factoryA = await CrosschainERC20FactoryFactory.connect(ownerA).deploy(lordA.address) as CrosschainERC20Factory
    await factoryA.deployed()
    factoryB = await CrosschainERC20FactoryFactory.connect(ownerB).deploy(lordB.address) as CrosschainERC20Factory
    await factoryB.deployed()

    let tx = await assetRegistryA.connect(ownerA).grant(ownerA.address)
    await tx.wait()

    const MockTokenFactory = await ethers.getContractFactory("MockToken")
    tubeTokenA = await MockTokenFactory.connect(ownerA).deploy("name", "symbol", 6) as MockToken
    await tubeTokenA.deployed()
    tubeTokenB = await MockTokenFactory.connect(ownerB).deploy("name", "symbol", 6) as MockToken
    await tubeTokenB.deployed()

    const TubeFactory = await ethers.getContractFactory("Tube")
    tubeA = await TubeFactory.connect(ownerA).deploy(
      CHAIN_ID_A,
      ledgerA.address,
      lordA.address,
      verifierA.address,
      tubeTokenA.address,
      treasureA.address,
    ) as Tube
    await tubeA.deployed()
    tubeB = await TubeFactory.connect(ownerB).deploy(
      CHAIN_ID_B,
      ledgerB.address,
      lordB.address,
      verifierB.address,
      tubeTokenB.address,
      treasureB.address,
    ) as Tube
    await tubeB.deployed()

    tx = await lordA.connect(ownerA).transferOwnership(tubeA.address)
    await tx.wait()
    tx = await lordB.connect(ownerB).transferOwnership(tubeB.address)
    await tx.wait()

    tx = await ledgerA.connect(ownerA).transferOwnership(tubeA.address)
    await tx.wait()
    tx = await ledgerB.connect(ownerB).transferOwnership(tubeB.address)
    await tx.wait()

    tx = await tubeA.connect(ownerA).pause()
    await tx.wait()
    tx = await tubeA.connect(ownerA).acceptOwnerships()
    await tx.wait()
    tx = await tubeA.connect(ownerA).unpause()
    await tx.wait()
    tx = await tubeB.connect(ownerB).pause()
    await tx.wait()
    tx = await tubeB.connect(ownerB).acceptOwnerships()
    await tx.wait()
    tx = await tubeB.connect(ownerB).unpause()
    await tx.wait()

    coTokenA = await MockTokenFactory.connect(ownerA).deploy("name", "symbol", 6) as MockToken
    await coTokenA.deployed()

    let ret = await factoryA.connect(ownerA).createLocalToken(coTokenA.address, "name", "symbol", 6)
    let receipt = await ret.wait()
    let event = _.find(receipt.events, (e: any) => e.event == "NewCrosschainERC20")
    let CrosschainERC20Factory = await ethers.getContractFactory("CrosschainERC20")
    ceA = CrosschainERC20Factory.attach(event.args[0]) as CrosschainERC20

    ret = await factoryB.connect(ownerB).createForeignToken("name", "symbol", 6)
    receipt = await ret.wait()
    event = _.find(receipt.events, (e: any) => e.event == "NewCrosschainERC20")
    CrosschainERC20Factory = await ethers.getContractFactory("CrosschainERC20")
    ceB = CrosschainERC20Factory.attach(event.args[0]) as CrosschainERC20

    tx = await assetRegistryA.connect(ownerA).addOriginalAsset(CHAIN_ID_A, ceA.address)
    await tx.wait()
    const assetID = await assetRegistryA.assetID(CHAIN_ID_A, ceA.address);
    await assetRegistryA.addAssetOnTube(assetID, CHAIN_ID_B, ceB.address)
  })

  it("transfer", async function () {
    const amount = 1000000
    let tx = await coTokenA.connect(ownerA).mint(holder1.address, amount)
    await tx.wait()

    tx = await coTokenA.connect(holder1).approve(ceA.address, amount)
    await tx.wait()

    await expect(ceA.connect(holder1).deposit(amount))
      .to.emit(coTokenA, "Transfer")
      .withArgs(holder1.address, ceA.address, amount)
      .to.emit(ceA, "Transfer")
      .withArgs(ethers.constants.AddressZero, holder1.address, amount)

    await expect(ceA.connect(holder1).approve(lordA.address, amount))
      .to.emit(ceA, "Approval")
      .withArgs(holder1.address, lordA.address, amount)

    await expect(tubeA.connect(holder1).deposit(CHAIN_ID_A, ceA.address, amount, "0x"))
      .to.emit(tubeA, "Receipt")
      .withArgs(CHAIN_ID_A, ceA.address, 1, holder1.address, holder1.address, amount, "0x", 0)

    await expect(verifierB.addAll([VALIDATOR_ADDRESSES[0]]))
      .to.emit(verifierB, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[0])

    await expect(verifierB.addAll([VALIDATOR_ADDRESSES[1]]))
      .to.emit(verifierB, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[1])

    await expect(verifierB.addAll([VALIDATOR_ADDRESSES[2]]))
      .to.emit(verifierB, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[2])

    let key = await tubeB.genKey(CHAIN_ID_A, 1, ceB.address, holder1.address, amount, "0x")

    let s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
    let s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
    let s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
    let signature = "0x" + s1 + s2 + s3

    await expect(tubeB.connect(holder1).withdraw(CHAIN_ID_A, 1, ceB.address, holder1.address, amount, "0x", signature))
      .to.emit(tubeB, "Settled")
      .withArgs(key, VALIDATOR_ADDRESSES, true)

    expect(await ceB.balanceOf(holder1.address)).to.equal(amount)

    await expect(ceB.connect(holder1).approve(lordB.address, amount))
      .to.emit(ceB, "Approval")
      .withArgs(holder1.address, lordB.address, amount)

    await expect(tubeB.connect(holder1).deposit(CHAIN_ID_B, ceB.address, amount, "0x"))
      .to.emit(tubeB, "Receipt")
      .withArgs(CHAIN_ID_B, ceB.address, 1, holder1.address, holder1.address, amount, "0x", 0)

    await expect(verifierA.addAll([VALIDATOR_ADDRESSES[0]]))
      .to.emit(verifierA, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[0])

    await expect(verifierA.addAll([VALIDATOR_ADDRESSES[1]]))
      .to.emit(verifierA, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[1])

    await expect(verifierA.addAll([VALIDATOR_ADDRESSES[2]]))
      .to.emit(verifierA, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[2])

    key = await tubeA.genKey(CHAIN_ID_B, 1, ceA.address, holder1.address, amount, "0x")

    s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
    s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
    s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
    signature = "0x" + s1 + s2 + s3

    await expect(tubeA.connect(holder1).withdraw(CHAIN_ID_B, 1, ceA.address, holder1.address, amount, "0x", signature))
      .to.emit(tubeA, "Settled")
      .withArgs(key, VALIDATOR_ADDRESSES, true)

    expect(await ceA.balanceOf(holder1.address)).to.equal(amount)

    await expect(ceA.connect(holder1).withdraw(amount))
      .to.emit(coTokenA, "Transfer")
      .withArgs(ceA.address, holder1.address, amount)

    expect(await coTokenA.balanceOf(holder1.address)).to.equal(amount)
  })
})
