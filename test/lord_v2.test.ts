import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { LordV2 } from "../types/LordV2";
import { MockToken } from "../types/MockToken";

describe("lord v2 tests", () => {
  let lord: LordV2
  let token: MockToken

  let owner: SignerWithAddress
  let operator: SignerWithAddress
  const ACCOUNT = "0x0000000000000000000000000000000000000001"

  beforeEach(async function () {
    [owner, operator] = await ethers.getSigners()

    const tokenFactory = await ethers.getContractFactory("MockToken")
    token = await tokenFactory.deploy(
      "Test Token",
      "TEST",
      8
    ) as MockToken
    
    const factory = await ethers.getContractFactory("LordV2")
    lord = await factory.deploy() as LordV2
    await lord.initialize()

    await token.transferOwnership(lord.address)
  })

  it("check mint", async () => {
    await expect(
      lord.connect(operator).mint(token.address, ACCOUNT, 1)
    ).to.be.revertedWith("invalid operator")

    await expect(
      lord.connect(operator).addOperator(operator.address)
    ).to.be.revertedWith("caller is not the owner")

    await expect(
      lord.connect(owner).removeOperator(operator.address)
    ).to.be.revertedWith("not an operator")
    await lord.connect(owner).addOperator(operator.address)
    await expect(
      lord.connect(owner).addOperator(operator.address)
    ).to.be.revertedWith("already an operator")

    expect(0).to.equals(await token.balanceOf(ACCOUNT))
    await lord.connect(operator).mint(token.address, ACCOUNT, 1)
    expect(1).to.equals(await token.balanceOf(ACCOUNT))
  })
})
