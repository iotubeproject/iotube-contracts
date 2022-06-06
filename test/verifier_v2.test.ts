import { ethers } from "hardhat"
import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { EmergencyOperator } from "../types/EmergencyOperator";
import { VerifierV2 } from "../types/VerifierV2";

describe("verifier v2 tests", () => {
  let verifier: VerifierV2
  let emergencyOperator: EmergencyOperator

  let owner: SignerWithAddress
  let operator: SignerWithAddress

  beforeEach(async function () {
    [owner, operator] = await ethers.getSigners()

    const emergencyOperatorFactory = await ethers.getContractFactory("EmergencyOperator")
    emergencyOperator = await emergencyOperatorFactory.deploy() as EmergencyOperator

    const verifierFactory = await ethers.getContractFactory("VerifierV2")
    verifier = await verifierFactory.deploy(emergencyOperator.address) as VerifierV2
  })

  it("check emergency pause", async () => {
    expect(owner.address).to.equals(await verifier.owner())

    await expect(verifier.connect(operator).pause()).to.be.revertedWith("no permission")

    await emergencyOperator.connect(owner).addEmergencyOperator(operator.address)

    await verifier.connect(operator).pause()

    expect(await verifier.paused()).to.be.true
  })
})
