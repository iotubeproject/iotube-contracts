import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const CHAIN_ID = 4690;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_SIGNATURE = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

describe('tube test', function() {
    let lord: Contract;
    let ledger: Contract;
    let assetRegistry: Contract;
    let factory: Contract;
    let tubeToken: Contract;
    let tube: Contract;
    let srcToken: Contract;
    let coToken: Contract;
    let ccToken: Contract;

    let owner: SignerWithAddress;
    let validator1: SignerWithAddress;
    let validator2: SignerWithAddress;
    let validator3: SignerWithAddress;
    let holder1: SignerWithAddress;
    let holder2: SignerWithAddress;
    let holder3: SignerWithAddress;
    let attacker: SignerWithAddress;

    beforeEach(async function() {
        [ owner, validator1, validator2, validator3, holder1, holder2, holder3, attacker ] = await ethers.getSigners();

        const Lord = await ethers.getContractFactory("Lord");
        lord = await Lord.deploy();
        await lord.deployed();

        const Ledger = await ethers.getContractFactory("Ledger");
        ledger = await Ledger.deploy();
        await ledger.deployed();

        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        assetRegistry = await AssetRegistry.deploy();
        await assetRegistry.deployed();

        const CCFactory = await ethers.getContractFactory('CCFactory');
        factory = await CCFactory.deploy(lord.address, assetRegistry.address);
        await factory.deployed();

        let tx = await assetRegistry.transferOwnership(factory.address);
        await tx.wait();

        const MockToken = await ethers.getContractFactory("MockToken");
        tubeToken = await MockToken.deploy('name', 'symbol', 6);
        await tubeToken.deployed();

        const Tube = await ethers.getContractFactory("Tube");
        tube = await Tube.deploy(
            CHAIN_ID,
            ledger.address,
            lord.address,
            tubeToken.address,
            assetRegistry.address
        );
        await tube.deployed();

        tx = await ledger.transferOwnership(tube.address);
        await tx.wait();

        srcToken = await MockToken.deploy('name', 'symbol', 6);
        await srcToken.deployed();

        coToken = await MockToken.deploy('name', 'symbol', 6);
        await coToken.deployed();

        const ret = await factory.createToken(
            CHAIN_ID,
            srcToken.address,
            coToken.address,
            'name',
            'symbol',
            6
        );

        const receipt = await ret.wait();
        const event = _.find(receipt.events, (e: any) => e.event == 'NewCCToken');
        const CCToken = await ethers.getContractFactory("CCToken");
        ccToken = CCToken.attach(event.args[0]);
    });

    it('Validator', async function() {
        await expect(tube.addValidator(validator1.address))
            .to.be.revertedWith('not paused');

        await tube.pause();
        await expect(tube.addValidator(validator1.address))
            .to.emit(tube, "ValidatorAdded")
            .withArgs(validator1.address);

        expect(await tube.numOfValidators()).to.equal(1);

        await expect(tube.removeValidator(validator1.address))
            .to.emit(tube, "ValidatorRemoved")
            .withArgs(validator1.address);

        expect(await tube.numOfValidators()).to.equal(0);

        await tube.unpause();
    });

    describe('depositTo', function() {
        it('invalid recipient', async function() {
            await expect(tube.depositTo(CHAIN_ID, holder3.address, ZERO_ADDRESS, 1000))
                .to.be.revertedWith('invalid recipient');
        });
    });

    describe('deposit', function() {
        it ('invalid amount', async function() {
            await expect(tube.deposit(CHAIN_ID, srcToken.address, 0))
                .to.be.revertedWith('invalid amount');
        });

        it ('invalid tubeID and token', async function() {
            await expect(tube.deposit(CHAIN_ID, holder3.address, 1000))
                .to.be.revertedWith('invalid tubeID and token');
        });

        it ('without fee', async function() {
            await tube.setFee(CHAIN_ID, 1000000);

            await expect(tube.deposit(CHAIN_ID, srcToken.address, 1000))
                .to.be.revertedWith('transfer amount exceeds balance');
        });

        it ('success without fee', async function() {
            await expect(srcToken.mint(owner.address, 1000000))
                .to.emit(srcToken, "Transfer")
                .withArgs(ZERO_ADDRESS, owner.address, 1000000);

            await expect(srcToken.approve(tube.address, 300000))
                .to.emit(srcToken, "Approval")
                .withArgs(owner.address, tube.address, 300000);

            await expect(tube.deposit(CHAIN_ID, srcToken.address, 300000))
                .to.emit(tube, "Receipt")
                .withArgs(
                    CHAIN_ID,
                    srcToken.address,
                    0,
                    owner.address,
                    owner.address,
                    300000,
                    0
                );

            expect(await srcToken.balanceOf(owner.address)).to.equal(700000);
        });

        it ('success with fee', async function() {
            const fee = 1000000;
            const tx = await tube.setFee(CHAIN_ID, fee);
            await tx.wait();

            await expect(tubeToken.mint(owner.address, 3000000))
                .to.emit(tubeToken, "Transfer")
                .withArgs(ZERO_ADDRESS, owner.address, 3000000);
            
            await expect(srcToken.mint(owner.address, 1000000))
                .to.emit(srcToken, "Transfer")
                .withArgs(ZERO_ADDRESS, owner.address, 1000000);
            
            await expect(tubeToken.approve(tube.address, 1000000))
                .to.emit(tubeToken, "Approval")
                .withArgs(owner.address, tube.address, 1000000);

            await expect(srcToken.approve(tube.address, 300000))
                .to.emit(srcToken, "Approval")
                .withArgs(owner.address, tube.address, 300000);

            await expect(tube.deposit(CHAIN_ID, srcToken.address, 300000))
                .to.emit(tube, "Receipt")
                .withArgs(
                    CHAIN_ID,
                    srcToken.address,
                    0,
                    owner.address,
                    owner.address,
                    300000,
                    1000000
                );

            expect(await tubeToken.balanceOf(owner.address)).to.equal(2000000);
            expect(await srcToken.balanceOf(owner.address)).to.equal(700000);
        });
    });

    describe('withdraw', function() {

        beforeEach(async function() {
            await tube.pause();
            await expect(tube.addValidator(validator1.address))
                .to.emit(tube, "ValidatorAdded")
                .withArgs(validator1.address);

            await expect(tube.addValidator(validator2.address))
                .to.emit(tube, "ValidatorAdded")
                .withArgs(validator2.address);

            await expect(tube.addValidator(validator3.address))
                .to.emit(tube, "ValidatorAdded")
                .withArgs(validator3.address);

            await tube.unpause();
        });

        it('amount is 0', async function() {
            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, holder1.address, 0, 0x00))
                .to.be.revertedWith('amount is 0');
        });

        it('invalid recipient', async function() {
            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, ZERO_ADDRESS, 1000, 0x00))
                .to.be.revertedWith('invalid recipient');
        });

        it('invalid signature length', async function() {
            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, holder1.address, 1000, 0x00))
                .to.be.revertedWith('invalid signature length');
        });

        it('invalid tubeId and token', async function() {
            await expect(tube.withdraw(CHAIN_ID, holder3.address, 0, holder1.address, 1000, ZERO_SIGNATURE))
                .to.be.revertedWith('invalid tubeId and token');
        });

        it('invalid validator', async function() {
            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, holder1.address, 1000, ZERO_SIGNATURE))
            .to.be.revertedWith('invalid validator');
        });

        it('insufficient validators', async function() {

        });

        it('success', async function() {

        });
    });

    describe('withdrawInBatch', function() {

    });
});
