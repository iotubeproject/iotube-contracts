import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { VerifierV2 } from "../types/VerifierV2";

describe("verifier v2 tests", () => {
  let verifier: VerifierV2

  let owner: SignerWithAddress
  let emergencyOperator: SignerWithAddress

  beforeEach(async function () {
    [owner, emergencyOperator] = await ethers.getSigners()
    
    const verifierFactory = await ethers.getContractFactory("VerifierV2")
    verifier = await verifierFactory.deploy() as VerifierV2
  })

  it("check emergency pause", async () => {
    expect(owner.address).to.equals(await verifier.owner())

    await expect(verifier.connect(emergencyOperator).pause()).to.be.revertedWith("caller is not emergency operator")

    await verifier.connect(owner).setEmergencyOperator(emergencyOperator.address)

    await verifier.connect(emergencyOperator).pause()

    expect(await verifier.paused()).to.be.true
  })
})
