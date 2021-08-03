import _ from "lodash";
import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ecsign, toBuffer, setLengthLeft } from "ethereumjs-util";

const privateKeyToAddress = require("ethereum-private-key-to-address");

describe("router test", function () {
  const amount = 123456789;
  let wrappedCoin: Contract;
  let ccCoin: Contract;
  let router: Contract;

  let holder1: SignerWithAddress;
  let holder2: SignerWithAddress;
  let holder3: SignerWithAddress;
  let attacker: SignerWithAddress;

  beforeEach(async function () {
    [holder1, holder2, holder3, attacker] = await ethers.getSigners();

    const WIOTX = await ethers.getContractFactory("WIOTX");
    wrappedCoin = await WIOTX.deploy();

    const CCERC20 = await ethers.getContractFactory("CCERC20");
    ccCoin = await CCERC20.deploy(wrappedCoin.address, "0x0000000000000000000000000000000000000000", "crosschain-iotx", "cc-iotx", 18);

    const CCCoinRouter = await ethers.getContractFactory("CCCoinRouter");
    router = await CCCoinRouter.deploy(ccCoin.address);
    await wrappedCoin.connect(holder1).approve(router.address, "1000000000000000000000000000");
    await ccCoin.connect(holder1).approve(router.address, "1000000000000000000000000000");
  })

  it("iotx->wiotx->cc-iotx->iotx", async function () {
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapCoinForWrappedCoin(amount, {value: amount});
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(amount);
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapWrappedCoinForCCCoin(amount);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(amount);
    await router.connect(holder1).swapCCCoinForCoin(amount);
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(0);
  });

  it("iotx<->cc-iotx->wiotx->iotx", async function () {
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapCoinForCCCoin(amount, {value: amount});
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(amount);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapCCCoinForWrappedCoin(amount);
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(0);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(amount);
    await router.connect(holder1).swapWrappedCoinForCoin(amount);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
  });
});