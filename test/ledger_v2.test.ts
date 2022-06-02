import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { LedgerV2 } from "../types/LedgerV2";

describe("ledger v2 tests", () => {
  let ledger: LedgerV2

  let owner: SignerWithAddress
  let operator: SignerWithAddress
  const TEST_ID = "0x0000000000000000000000000000000000000000000000000000000000000001"

  beforeEach(async function () {
    [owner, operator] = await ethers.getSigners()
    
    const factory = await ethers.getContractFactory("LedgerV2")
    ledger = await factory.deploy() as LedgerV2
  })

  it("check record", async () => {
    await expect(
      ledger.connect(operator).record(TEST_ID)
    ).to.be.revertedWith("invalid operator")

    await expect(
      ledger.connect(operator).addOperator(operator.address)
    ).to.be.revertedWith("Ownable: caller is not the owner")

    await expect(
      ledger.connect(owner).removeOperator(operator.address)
    ).to.be.revertedWith("not an operator")
    await ledger.connect(owner).addOperator(operator.address)
    await expect(
      ledger.connect(owner).addOperator(operator.address)
    ).to.be.revertedWith("already an operator")

    expect(0).to.equals(await ledger.get(TEST_ID))

    ledger.connect(operator).record(TEST_ID)
    await expect(
      ledger.connect(operator).record(TEST_ID)
    ).to.be.revertedWith("duplicate record")
  })
})
