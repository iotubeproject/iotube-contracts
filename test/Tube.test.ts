import _ from "lodash"
import { ethers } from "hardhat"
import { expect } from "chai"
import { Contract } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ecsign, toBuffer, setLengthLeft } from "ethereumjs-util"

const privateKeyToAddress = require("ethereum-private-key-to-address")

const CHAIN_ID = 4690
const FOREIGN_CHAIN_ID = 1
const CHAIN_ID_A = 4689
const CHAIN_ID_B = 4690
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
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
  let lord: Contract
  let ledger: Contract
  let verifier: Contract
  let assetRegistry: Contract
  let factory: Contract
  let tubeToken: Contract
  let tube: Contract
  let coToken: Contract
  let localToken: Contract
  let foreignToken: Contract

  let owner: SignerWithAddress
  let holder1: SignerWithAddress
  let holder2: SignerWithAddress
  let holder3: SignerWithAddress
  let attacker: SignerWithAddress
  let treasure: SignerWithAddress

  beforeEach(async function () {
    [owner, holder1, holder2, holder3, attacker, treasure] = await ethers.getSigners()

    const Lord = await ethers.getContractFactory("Lord")
    lord = await Lord.deploy()
    await lord.deployed()

    const Ledger = await ethers.getContractFactory("Ledger")
    ledger = await Ledger.deploy()
    await ledger.deployed()

    const Verifier = await ethers.getContractFactory("Verifier")
    verifier = await Verifier.deploy()
    await verifier.deployed()

    const AssetRegistry = await ethers.getContractFactory("AssetRegistry")
    assetRegistry = await AssetRegistry.deploy()
    await assetRegistry.deployed()

    const CCFactory = await ethers.getContractFactory("CCFactory")
    factory = await CCFactory.deploy(lord.address)
    await factory.deployed()

    let tx = await assetRegistry.grant(owner.address)
    await tx.wait()

    const MockToken = await ethers.getContractFactory("MockToken")
    tubeToken = await MockToken.deploy("name", "symbol", 6)
    await tubeToken.deployed()

    const Tube = await ethers.getContractFactory("Tube")
    tube = await Tube.deploy(CHAIN_ID, ledger.address, lord.address, verifier.address, tubeToken.address, treasure.address)
    await tube.deployed()

    tx = await lord.transferOwnership(tube.address)
    await tx.wait()

    tx = await ledger.transferOwnership(tube.address)
    await tx.wait()

    coToken = await MockToken.deploy("name", "symbol", 6)
    await coToken.deployed()

    let ret = await factory.createLocalToken(coToken.address, "name", "symbol", 6)
    let receipt = await ret.wait()
    let event = _.find(receipt.events, (e: any) => e.event == "NewCCERC20")
    let CCERC20 = await ethers.getContractFactory("CCERC20")
    localToken = CCERC20.attach(event.args[0])

    ret = await factory.createForeignToken("name", "symbol", 6)
    receipt = await ret.wait()
    event = _.find(receipt.events, (e: any) => e.event == "NewCCERC20")
    CCERC20 = await ethers.getContractFactory("CCERC20")
    foreignToken = CCERC20.attach(event.args[0])

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
      await expect(tube.depositTo(CHAIN_ID, holder3.address, ZERO_ADDRESS, 1000, "0x")).to.be.revertedWith(
        "invalid recipient",
      )
    })
  })

  describe("deposit", function () {
    it("invalid amount", async function () {
      await expect(tube.deposit(CHAIN_ID, localToken.address, 0, "0x")).to.be.revertedWith("invalid amount")
    })

    it("without fee", async function () {
      await tube.setFee(CHAIN_ID, 1000000)

      await expect(tube.deposit(CHAIN_ID, localToken.address, 1000, "0x")).to.be.revertedWith(
        "transfer amount exceeds balance",
      )
    })

    it("success without fee", async function () {
      await expect(coToken.mint(owner.address, 1000000))
        .to.emit(coToken, "Transfer")
        .withArgs(ZERO_ADDRESS, owner.address, 1000000)

      await coToken.approve(localToken.address, 1000000)

      await expect(localToken.deposit(1000000))
        .to.emit(coToken, "Transfer")
        .withArgs(owner.address, localToken.address, 1000000)

      await expect(localToken.approve(tube.address, 300000))
        .to.emit(localToken, "Approval")
        .withArgs(owner.address, tube.address, 300000)

      await expect(tube.deposit(CHAIN_ID, localToken.address, 300000, "0x"))
        .to.emit(tube, "Receipt")
        .withArgs(CHAIN_ID, localToken.address, 1, owner.address, owner.address, 300000, "0x", 0)

      expect(await localToken.balanceOf(owner.address)).to.equal(700000)
    })

    it("success with fee", async function () {
      const fee = 1000000
      const tx = await tube.setFee(CHAIN_ID, fee)
      await tx.wait()

      await expect(coToken.mint(owner.address, 1000000))
        .to.emit(coToken, "Transfer")
        .withArgs(ZERO_ADDRESS, owner.address, 1000000)

      await coToken.approve(localToken.address, 1000000)

      await expect(localToken.deposit(1000000))
        .to.emit(coToken, "Transfer")
        .withArgs(owner.address, localToken.address, 1000000)

      await expect(tubeToken.mint(owner.address, 3000000))
        .to.emit(tubeToken, "Transfer")
        .withArgs(ZERO_ADDRESS, owner.address, 3000000)

      await expect(tubeToken.approve(tube.address, 1000000))
        .to.emit(tubeToken, "Approval")
        .withArgs(owner.address, tube.address, 1000000)

      await expect(localToken.approve(tube.address, 300000))
        .to.emit(localToken, "Approval")
        .withArgs(owner.address, tube.address, 300000)

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
        tube.withdraw(CHAIN_ID, 1, localToken.address, ZERO_ADDRESS, 1000, "0x", ZERO_THREE_SIGNATURES),
      ).to.be.revertedWith("invalid recipient")
    })

    it("invalid signature length", async function () {
      await expect(tube.withdraw(CHAIN_ID, 1, localToken.address, holder1.address, 1000, "0x", 0x00)).to.be.revertedWith(
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
    let safe: Contract;
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

      const MockSafe = await ethers.getContractFactory("MockSafe");
      safe = await MockSafe.deploy();
      await safe.deployed();
    })

    it("fail", async function () {
      const amount = 999;
      const bytecode = "0x8340f549" + foreignToken.address.substring(2).padStart(64, "0") + holder1.address.substring(2).padStart(64, "0") + amount.toString(16).padStart(64, "0")
      const key = await tube.genKey(CHAIN_ID, 1, foreignToken.address, safe.address, amount, bytecode)

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
      const s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
      const signature = "0x" + s1 + s2 + s3

      await expect(tube.withdraw(CHAIN_ID, 1, foreignToken.address, safe.address, amount, bytecode, signature))
        .to.emit(tube, "Settled")
        .withArgs(key, VALIDATOR_ADDRESSES, false)

      expect(await foreignToken.balanceOf(safe.address)).to.equal(0)
      expect(await foreignToken.balanceOf(tube.address)).to.equal(amount)
    })

    it("success", async function () {
      const amount = 1000;
      const bytecode = "0x8340f549" + foreignToken.address.substring(2).padStart(64, "0") + holder1.address.substring(2).padStart(64, "0") + amount.toString(16).padStart(64, "0")
      const key = await tube.genKey(CHAIN_ID, 1, foreignToken.address, safe.address, amount, bytecode)

      const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
      const s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
      const s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
      const signature = "0x" + s1 + s2 + s3

      await expect(tube.withdraw(CHAIN_ID, 1, foreignToken.address, safe.address, amount, bytecode, signature))
        .to.emit(tube, "Settled")
        .withArgs(key, VALIDATOR_ADDRESSES, true)

      expect(await foreignToken.balanceOf(safe.address)).to.equal(amount)
      expect(await safe.points(foreignToken.address, holder1.address)).to.equal(amount)
    })
  })

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
})

describe("tube integrate test", function () {
  let lordA: Contract
  let ledgerA: Contract
  let verifierA: Contract
  let assetRegistryA: Contract
  let factoryA: Contract
  let tubeTokenA: Contract
  let tubeA: Contract

  let lordB: Contract
  let ledgerB: Contract
  let verifierB: Contract
  let assetRegistryB: Contract
  let factoryB: Contract
  let tubeTokenB: Contract
  let tubeB: Contract

  let coTokenA: Contract
  let ccTokenA: Contract
  let ccTokenB: Contract

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

    const Lord = await ethers.getContractFactory("Lord")
    lordA = await Lord.connect(ownerA).deploy()
    await lordA.deployed()
    lordB = await Lord.connect(ownerB).deploy()
    await lordB.deployed()

    const Ledger = await ethers.getContractFactory("Ledger")
    ledgerA = await Ledger.connect(ownerA).deploy()
    await ledgerA.deployed()
    ledgerB = await Ledger.connect(ownerB).deploy()
    await ledgerB.deployed()

    const Verifier = await ethers.getContractFactory("Verifier")
    verifierA = await Verifier.connect(ownerA).deploy()
    await verifierA.deployed()
    verifierB = await Verifier.connect(ownerB).deploy()
    await verifierB.deployed()

    const AssetRegistry = await ethers.getContractFactory("AssetRegistry")
    assetRegistryA = await AssetRegistry.connect(ownerA).deploy()
    await assetRegistryA.deployed()

    const CCFactory = await ethers.getContractFactory("CCFactory")
    factoryA = await CCFactory.connect(ownerA).deploy(lordA.address)
    await factoryA.deployed()
    factoryB = await CCFactory.connect(ownerB).deploy(lordB.address)
    await factoryB.deployed()

    let tx = await assetRegistryA.connect(ownerA).grant(ownerA.address)
    await tx.wait()

    const MockToken = await ethers.getContractFactory("MockToken")
    tubeTokenA = await MockToken.connect(ownerA).deploy("name", "symbol", 6)
    await tubeTokenA.deployed()
    tubeTokenB = await MockToken.connect(ownerB).deploy("name", "symbol", 6)
    await tubeTokenB.deployed()

    const Tube = await ethers.getContractFactory("Tube")
    tubeA = await Tube.connect(ownerA).deploy(
      CHAIN_ID_A,
      ledgerA.address,
      lordA.address,
      verifierA.address,
      tubeTokenA.address,
      treasureA.address,
    )
    await tubeA.deployed()
    tubeB = await Tube.connect(ownerB).deploy(
      CHAIN_ID_B,
      ledgerB.address,
      lordB.address,
      verifierB.address,
      tubeTokenB.address,
      treasureB.address,
    )
    await tubeB.deployed()

    tx = await lordA.connect(ownerA).transferOwnership(tubeA.address)
    await tx.wait()
    tx = await lordB.connect(ownerB).transferOwnership(tubeB.address)
    await tx.wait()

    tx = await ledgerA.connect(ownerA).transferOwnership(tubeA.address)
    await tx.wait()
    tx = await ledgerB.connect(ownerB).transferOwnership(tubeB.address)
    await tx.wait()

    coTokenA = await MockToken.connect(ownerA).deploy("name", "symbol", 6)
    await coTokenA.deployed()

    let ret = await factoryA.connect(ownerA).createLocalToken(coTokenA.address, "name", "symbol", 6)
    let receipt = await ret.wait()
    let event = _.find(receipt.events, (e: any) => e.event == "NewCCERC20")
    let CCERC20 = await ethers.getContractFactory("CCERC20")
    ccTokenA = CCERC20.attach(event.args[0])

    ret = await factoryB.connect(ownerB).createForeignToken("name", "symbol", 6)
    receipt = await ret.wait()
    event = _.find(receipt.events, (e: any) => e.event == "NewCCERC20")
    CCERC20 = await ethers.getContractFactory("CCERC20")
    ccTokenB = CCERC20.attach(event.args[0])

    tx = await assetRegistryA.connect(ownerA).addOriginalAsset(CHAIN_ID_A, ccTokenA.address)
    await tx.wait()
    const assetID = await assetRegistryA.assetID(CHAIN_ID_A, ccTokenA.address);
    await assetRegistryA.addAssetOnTube(assetID, CHAIN_ID_B, ccTokenB.address)
  })

  it("transfer", async function () {
    const amount = 1000000
    let tx = await coTokenA.connect(ownerA).mint(holder1.address, amount)
    await tx.wait()

    tx = await coTokenA.connect(holder1).approve(ccTokenA.address, amount)
    await tx.wait()

    await expect(ccTokenA.connect(holder1).deposit(amount))
      .to.emit(coTokenA, "Transfer")
      .withArgs(holder1.address, ccTokenA.address, amount)
      .to.emit(ccTokenA, "Transfer")
      .withArgs(ZERO_ADDRESS, holder1.address, amount)

    await expect(ccTokenA.connect(holder1).approve(tubeA.address, amount))
      .to.emit(ccTokenA, "Approval")
      .withArgs(holder1.address, tubeA.address, amount)

    await expect(tubeA.connect(holder1).deposit(CHAIN_ID_A, ccTokenA.address, amount, "0x"))
      .to.emit(tubeA, "Receipt")
      .withArgs(CHAIN_ID_A, ccTokenA.address, 1, holder1.address, holder1.address, amount, "0x", 0)

    await expect(verifierB.addAll([VALIDATOR_ADDRESSES[0]]))
      .to.emit(verifierB, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[0])

    await expect(verifierB.addAll([VALIDATOR_ADDRESSES[1]]))
      .to.emit(verifierB, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[1])

    await expect(verifierB.addAll([VALIDATOR_ADDRESSES[2]]))
      .to.emit(verifierB, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[2])

    let key = await tubeB.genKey(CHAIN_ID_A, 1, ccTokenB.address, holder1.address, amount, "0x")

    let s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
    let s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
    let s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
    let signature = "0x" + s1 + s2 + s3

    await expect(tubeB.connect(holder1).withdraw(CHAIN_ID_A, 1, ccTokenB.address, holder1.address, amount, "0x", signature))
      .to.emit(tubeB, "Settled")
      .withArgs(key, VALIDATOR_ADDRESSES, true)

    expect(await ccTokenB.balanceOf(holder1.address)).to.equal(amount)

    await expect(ccTokenB.connect(holder1).approve(tubeB.address, amount))
      .to.emit(ccTokenB, "Approval")
      .withArgs(holder1.address, tubeB.address, amount)

    await expect(tubeB.connect(holder1).deposit(CHAIN_ID_B, ccTokenB.address, amount, "0x"))
      .to.emit(tubeB, "Receipt")
      .withArgs(CHAIN_ID_B, ccTokenB.address, 1, holder1.address, holder1.address, amount, "0x", 0)

    await expect(verifierA.addAll([VALIDATOR_ADDRESSES[0]]))
      .to.emit(verifierA, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[0])

    await expect(verifierA.addAll([VALIDATOR_ADDRESSES[1]]))
      .to.emit(verifierA, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[1])

    await expect(verifierA.addAll([VALIDATOR_ADDRESSES[2]]))
      .to.emit(verifierA, "ValidatorAdded")
      .withArgs(VALIDATOR_ADDRESSES[2])

    key = await tubeA.genKey(CHAIN_ID_B, 1, ccTokenA.address, holder1.address, amount, "0x")

    s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0])
    s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1])
    s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2])
    signature = "0x" + s1 + s2 + s3

    await expect(tubeA.connect(holder1).withdraw(CHAIN_ID_B, 1, ccTokenA.address, holder1.address, amount, "0x", signature))
      .to.emit(tubeA, "Settled")
      .withArgs(key, VALIDATOR_ADDRESSES, true)

    expect(await ccTokenA.balanceOf(holder1.address)).to.equal(amount)

    await expect(ccTokenA.connect(holder1).withdraw(amount))
      .to.emit(coTokenA, "Transfer")
      .withArgs(ccTokenA.address, holder1.address, amount)

    expect(await coTokenA.balanceOf(holder1.address)).to.equal(amount)
  })
})
