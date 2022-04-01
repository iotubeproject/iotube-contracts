import _ from "lodash"
import { ethers } from "hardhat"
import { expect } from "chai"
import { Contract } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const privateKeyToAddress = require("ethereum-private-key-to-address")

describe("lord test", function () {
    const tokenID = 123456789;
    let coToken: Contract;
    let coTokenNFT: Contract;
    let lord: Contract;

    let owner: SignerWithAddress;
    let holder1: SignerWithAddress;
    let holder2: SignerWithAddress;
    let holder3: SignerWithAddress;
    let attacker: SignerWithAddress;

    beforeEach(async function () {
        [owner, holder1, holder2, holder3, attacker] = await ethers.getSigners();

        const Lord = await ethers.getContractFactory("Lord")
        lord = await Lord.connect(owner).deploy(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS)
        await lord.connect(owner).deployed()

        const MockToken = await ethers.getContractFactory("MockToken")
        coToken = await MockToken.deploy("name", "symbol", 6)
        await coToken.deployed()

        await coToken.connect(holder2).approve(lord.address, 1000000)

        const MockTokenNFT = await ethers.getContractFactory("MockTokenNFT")
        coTokenNFT = await MockTokenNFT.deploy("name", "symbol")
        await coTokenNFT.deployed()

        coTokenNFT.connect(holder3).setApprovalForAll(lord.address, true)
    })

    it("burn token", async function () {
        await expect(coToken.mint(holder2.address, 1000))
            .to.emit(coToken, "Transfer")
            .withArgs(ZERO_ADDRESS, holder2.address, 1000)
        expect(await coToken.balanceOf(holder2.address)).to.be.equal(1000)

        await lord.connect(owner).burn(coToken.address, holder2.address, 200);
        expect(await coToken.balanceOf(holder2.address)).to.equal(800);
    });

    it("mint token", async function () {
        expect(await coToken.balanceOf(holder2.address)).to.be.equal(0)
        await lord.connect(owner).mint(coToken.address, holder2.address, 1000);
        expect(await coToken.balanceOf(holder2.address)).to.equal(1000);
    });

    it("burn tokenNFT", async function () {
        await expect(coTokenNFT.safeMint(holder3.address, tokenID, "0x"))
            .to.emit(coTokenNFT, "Transfer")
            .withArgs(ZERO_ADDRESS, holder3.address, tokenID)

        await coTokenNFT.connect(holder3).approve(lord.address, tokenID)

        await lord.connect(owner).burnNFT(coTokenNFT.address, tokenID);
        expect(await coTokenNFT.balanceOf(holder3.address)).to.equal(0);
    });

    it("mint tokenNFT", async function () {
        expect(await coTokenNFT.balanceOf(holder3.address)).to.equal(0);
        await lord.connect(owner).mintNFT(coTokenNFT.address, tokenID, holder3.address, "0x");
        expect(await coTokenNFT.balanceOf(holder3.address)).to.equal(1);
    });
});
