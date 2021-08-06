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
  let cerc20: Contract;
  let router: Contract;

  let holder1: SignerWithAddress;
  let holder2: SignerWithAddress;
  let holder3: SignerWithAddress;
  let attacker: SignerWithAddress;

  beforeEach(async function () {
    [holder1, holder2, holder3, attacker] = await ethers.getSigners();

    const WIOTX = await ethers.getContractFactory("WIOTX");
    wrappedCoin = await WIOTX.deploy();

    const CrosschainERC20 = await ethers.getContractFactory("CrosschainERC20");
    cerc20 = await CrosschainERC20.deploy(wrappedCoin.address, "0x0000000000000000000000000000000000000000", "crosschain-iotx", "ciotx", 18);

    const CrosschainCoinRouter = await ethers.getContractFactory("CrosschainCoinRouter");
    router = await CrosschainCoinRouter.deploy(cerc20.address);
    await wrappedCoin.connect(holder1).approve(router.address, "1000000000000000000000000000");
    await cerc20.connect(holder1).approve(router.address, "1000000000000000000000000000");
  })

  it("iotx->wiotx->ciotx->iotx", async function () {
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapCoinForWrappedCoin(amount, {value: amount});
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(amount);
    expect(await cerc20.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapWrappedCoinForCrosschainCoin(amount);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
    expect(await cerc20.balanceOf(holder1.address)).to.equal(amount);
    await router.connect(holder1).swapCrosschainCoinForCoin(amount);
    expect(await cerc20.balanceOf(holder1.address)).to.equal(0);
  });

  it("iotx<->ciotx->wiotx->iotx", async function () {
    expect(await cerc20.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapCoinForCrosschainCoin(amount, {value: amount});
    expect(await cerc20.balanceOf(holder1.address)).to.equal(amount);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
    await router.connect(holder1).swapCrosschainCoinForWrappedCoin(amount);
    expect(await cerc20.balanceOf(holder1.address)).to.equal(0);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(amount);
    await router.connect(holder1).swapWrappedCoinForCoin(amount);
    expect(await wrappedCoin.balanceOf(holder1.address)).to.equal(0);
  });
});
