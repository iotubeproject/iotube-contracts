import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { MinterDAO } from "../types/MinterDAO"

describe("minter dao tests", () => {
  let minterDAO: MinterDAO

  let owner: SignerWithAddress
  let lord: SignerWithAddress
  let emergencyOperator: SignerWithAddress
  let pair: SignerWithAddress
  let attacker: SignerWithAddress

  beforeEach(async () => {
    [owner, lord, emergencyOperator, pair, attacker] = await ethers.getSigners()

    const minterDAOFactory = await ethers.getContractFactory("MinterDAO")
    minterDAO = await minterDAOFactory.deploy() as MinterDAO

    await minterDAO.initialize(lord.address, emergencyOperator.address)
  })

  it("check lord", async () => {
    expect(await minterDAO.isMinter(lord.address, "0x0000000000000000000000000000000000000001")).to.be.true

    await expect(minterDAO.connect(attacker).pause()).to.be.revertedWith("caller is not emergency operator")
    await minterDAO.connect(emergencyOperator).pause()
    await expect(minterDAO.isMinter(lord.address, "0x0000000000000000000000000000000000000001")).to.be.reverted
  })

  it("check pair", async () => {
    expect(await minterDAO.isMinter(pair.address, "0x0000000000000000000000000000000000000001")).to.be.false

    await minterDAO.connect(owner).addMinter(pair.address, "0x0000000000000000000000000000000000000001")

    expect(await minterDAO.isMinter(pair.address, "0x0000000000000000000000000000000000000001")).to.be.true

    await expect(minterDAO.connect(attacker).pause()).to.be.revertedWith("caller is not emergency operator")
    await minterDAO.connect(emergencyOperator).pause()
    await expect(minterDAO.isMinter(pair.address, "0x0000000000000000000000000000000000000001")).to.be.reverted
  })
})
