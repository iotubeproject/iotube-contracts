import _, { flatMap } from "lodash"
import { ethers } from "hardhat"
import { BigNumber } from "ethers"
import { expect } from "chai"
import { Contract } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ecsign, toBuffer, setLengthLeft } from "ethereumjs-util"

const privateKeyToAddress = require("ethereum-private-key-to-address")
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

describe("asset registry unit test", () => {
    let registry: Contract;
    let asset1: Contract;
    let asset2: Contract;
    let owner: SignerWithAddress;
    let hacker: SignerWithAddress;
    let operator: SignerWithAddress;
    let operator2: SignerWithAddress;

    beforeEach(async () => {
        [owner, hacker, operator, operator2] = await ethers.getSigners();
        const RegistryContract = await ethers.getContractFactory("AssetRegistryV2");
        registry = await RegistryContract.connect(owner).deploy();
        await registry.deployed();
        const MockToken = await ethers.getContractFactory("MockToken")
        asset1 = await MockToken.deploy("asset1", "symbol", 6)
        await asset1.deployed()
        asset2 = await MockToken.deploy("asset2", "symbol", 6)
        await asset2.deployed()
    });
    describe("owner functions", () => {
        beforeEach(async () => {
            expect(await registry.operators(operator.address)).to.equal(false);
        });
        describe("grant operator permission", () => {
            it("not owner", async () => {
                await expect(registry.connect(hacker).grant(operator.address)).to.be.revertedWith("caller is not the owner");
                expect(await registry.operators(operator.address)).to.equal(false);
            });
            describe("grant success", async () => {
                beforeEach(async () => {
                    let tx = await registry.grant(operator.address);
                    await tx.wait();
                    expect(await registry.operators(operator.address)).to.equal(true);
                });
                it("not owner", async () => {
                    await expect(registry.connect(hacker).revoke(operator.address)).to.be.revertedWith("caller is not the owner");
                    expect(await registry.operators(operator.address)).to.equal(true);
                });
                it("revoke success", async () => {
                    let tx = await registry.revoke(operator.address);
                    await tx.wait();
                    expect(await registry.operators(operator.address)).to.equal(false);
                });
            });
        });
    });
    describe("operator functions", () => {
        beforeEach(async () => {
            let tx = await registry.grant(operator.address);
            await tx.wait();
            expect(await registry.numOfAssets()).to.equal(0);
        });
        it("not operator", async () => {
            await expect(registry.connect(hacker).newAsset(0, asset1.address)).to.be.revertedWith("no permission");
            await expect(registry.connect(hacker).setAssetOnTube(0, 0, asset1.address)).to.be.revertedWith("no permission");
            await expect(registry.connect(hacker).removeAssetOnTube(0, 0)).to.be.revertedWith("no permission");
            await expect(registry.connect(hacker).activateAsset(0)).to.be.revertedWith("no permission");
            await expect(registry.connect(hacker).deactivateAsset(0)).to.be.revertedWith("no permission");
            await expect(registry.connect(hacker).activateTube(0)).to.be.revertedWith("no permission");
            await expect(registry.connect(hacker).deactivateTube(0)).to.be.revertedWith("no permission");
            await expect(registry.connect(hacker).activateAssetOnTube(0, 0)).to.be.revertedWith("no permission");
            await expect(registry.connect(hacker).deactivateAssetOnTube(0, 0)).to.be.revertedWith("no permission");
        });
        describe("add new asset", () => {
            let tubeIDs = [1, 2, 3];
            beforeEach(async () => {
                expect(await registry.numOfAssets()).to.equal(0);
            });
            it("invalid parameters", async () => {
                await expect(registry.connect(operator).newAsset(0, asset1.address)).to.be.revertedWith("invalid tube id");
                await expect(registry.connect(operator).newAsset(tubeIDs[0], ZERO_ADDRESS)).to.be.revertedWith("invalid asset address");
            });
            describe("add asset 1", () => {
                beforeEach(async () => {
                    expect(await registry.assetID(tubeIDs[0], asset1.address)).to.equal(0);
                    expect(await registry.assetID(tubeIDs[1], asset1.address)).to.equal(0);
                    expect(await registry.assetID(tubeIDs[2], asset2.address)).to.equal(0);
                    let tx = await registry.connect(operator).newAsset(tubeIDs[0], asset1.address);
                    let receipt = await tx.wait();
                    let event = _.find(receipt.events, (e: any) => e.event == "NewAsset");
                    expect(await registry.numOfAssets()).to.equal(1);
                    expect(await registry.assetID(tubeIDs[0], asset1.address)).to.equal(event.args.assetID);
                });
                it("duplicate asset", async () => {
                    await expect(registry.connect(operator).newAsset(tubeIDs[0], asset1.address)).to.be.revertedWith("duplicate asset");
                    expect(await registry.numOfAssets()).to.equal(1);
                });
                it("add asset 2", async () => {
                    let tx = await registry.connect(operator).newAsset(tubeIDs[2], asset2.address);
                    let receipt = await tx.wait();
                    let event = _.find(receipt.events, (e: any) => e.event == "NewAsset")
                    expect(await registry.assetID(tubeIDs[2], asset2.address)).to.equal(event.args.assetID);
                    expect(await registry.numOfAssets()).to.equal(2);
                });
                describe("add asset 1 on tube 2", () => {
                    const assetID = BigNumber.from(1);
                    beforeEach(async () => {
                        let tx = await registry.connect(operator).setAssetOnTube(assetID, tubeIDs[1], asset2.address);
                        let receipt = await tx.wait();
                        let event = _.find(receipt.events, (e: any) => e.event == "AssetSetOnTube");
                        expect(await registry.assetID(tubeIDs[1], asset2.address)).to.equal(assetID);
                    });
                    it("remove asset 1 on tube 2", async () => {
                        let tx = await registry.connect(operator).removeAssetOnTube(assetID, tubeIDs[1]);
                        let receipt = await tx.wait();
                        let event = _.find(receipt.events, (e: any) => e.event == "AssetRemovedOnTube");
                        expect(await registry.assetID(tubeIDs[1], asset2.address)).to.equal(0);
                    });
                    it("activate asset 1", async () => {
                        expect(await registry.isActive(assetID, tubeIDs[0])).to.equal(false);
                        expect(await registry.isActive(assetID, tubeIDs[1])).to.equal(false);
                        let tx = await registry.connect(operator).activateAsset(assetID);
                        let receipt = await tx.wait();
                        let event = _.find(receipt.events, (e: any) => e.event == "AssetActivated");
                        expect(event.args.id).to.equal(assetID);
                    });
                });
            });
        });
    });
    describe("public functions", () => {

    });
});
