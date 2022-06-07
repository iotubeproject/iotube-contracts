import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { EmergencyOperator } from "../types/EmergencyOperator"
import { MinterDAO } from "../types/MinterDAO"

describe("minter dao tests", () => {
  let minterDAO: MinterDAO
  let emergencyOperatorContract: EmergencyOperator

  let owner: SignerWithAddress
  let lord: SignerWithAddress
  let emergencyOperator: SignerWithAddress
  let pair: SignerWithAddress
  let attacker: SignerWithAddress

  beforeEach(async () => {
    [owner, lord, emergencyOperator, pair, attacker] = await ethers.getSigners()
    const emergencyOperatorFactory = await ethers.getContractFactory("EmergencyOperator")
    emergencyOperatorContract = await emergencyOperatorFactory.deploy() as EmergencyOperator
    await emergencyOperatorContract.initialize()
    await emergencyOperatorContract.addEmergencyOperator(emergencyOperator.address)

    const minterDAOFactory = await ethers.getContractFactory("MinterDAO")
    minterDAO = await minterDAOFactory.deploy() as MinterDAO

    await minterDAO.initialize(lord.address, emergencyOperatorContract.address)
  })

  it("check lord", async () => {
    expect(await minterDAO.isMinter(lord.address, "0x0000000000000000000000000000000000000001")).to.be.true

    await expect(minterDAO.connect(attacker).pause()).to.be.revertedWith("no permission")
    await minterDAO.connect(emergencyOperator).pause()
    await expect(minterDAO.isMinter(lord.address, "0x0000000000000000000000000000000000000001")).to.be.reverted
  })

  it("check pair", async () => {
    expect(await minterDAO.isMinter(pair.address, "0x0000000000000000000000000000000000000001")).to.be.false

    await minterDAO.connect(owner).addMinter(pair.address, "0x0000000000000000000000000000000000000001")
    await expect(
      minterDAO.connect(owner).addMinter(pair.address, "0x0000000000000000000000000000000000000001")
    ).to.be.revertedWith("already a minter")

    expect(await minterDAO.isMinter(pair.address, "0x0000000000000000000000000000000000000001")).to.be.true

    await expect(minterDAO.connect(attacker).pause()).to.be.revertedWith("no permission")
    await minterDAO.connect(emergencyOperator).pause()
    await expect(minterDAO.isMinter(pair.address, "0x0000000000000000000000000000000000000001")).to.be.reverted
  })
})
