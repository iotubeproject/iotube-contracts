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

    const CCToken = await ethers.getContractFactory("CCToken");
    ccCoin = await CCToken.deploy(wrappedCoin.address, "0x0000000000000000000000000000000000000000", "crosschain-iotx", "cc-iotx", 18);

    const CoinCCTokenRouter = await ethers.getContractFactory("CoinCCTokenRouter");
    router = await CoinCCTokenRouter.deploy(ccCoin.address);
    await wrappedCoin.connect(holder1).approve(router.address, "1000000000000000000000000000");
    await ccCoin.connect(holder1).approve(router.address, "1000000000000000000000000000");
  })

  it("iotx->wiotx->cc-iotx->iotx", async function () {
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapCoinForWrappedCoin(amount, {value: amount});
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(amount);
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapWrappedCoinForCCToken(amount);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(amount);
    await router.connect(holder1).swapCCTokenForCoin(amount);
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(0);
  });

  it("iotx<->cc-iotx->wiotx->iotx", async function () {
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapCoinForCCToken(amount, {value: amount});
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(amount);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapCCTokenForWrappedCoin(amount);
    expect(await ccCoin.balanceOf(holder1.address)).to.equal(0);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(amount);
    await router.connect(holder1).swapWrappedCoinForCoin(amount);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
  });
});
