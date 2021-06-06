import _ from 'lodash';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
    ecsign,
    toBuffer,
    setLengthLeft
} from "ethereumjs-util";

const privateKeyToAddress = require('ethereum-private-key-to-address');

const CHAIN_ID = 4690;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_THREE_SIGNATURES = '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

const VALIDATOR_PRIVATE_KEYS = [
    '18259bcf8198b35f3c1e863dab2f1663d1fd0dbe91c13d1a994bee3026ce790f',
    '43626b973fa6d002d5ffc1b3a639d81f2ab4bd0dd4a209ae7f560d1d71d91e42',
    '5b60ef73cf995182d606c893544a0a15dc7d2c5b9f870952120649655ebb98c0'
];

const VALIDATOR_ADDRESSES = VALIDATOR_PRIVATE_KEYS.map(v => privateKeyToAddress(v));

function sign(hash: string, privateKey: string) {
    const { r, s, v } = ecsign(Buffer.from(hash, 'hex'), Buffer.from(privateKey, 'hex'));
    const signature = Buffer.concat([
        setLengthLeft(r, 32),
        setLengthLeft(s, 32),
        toBuffer(v)
    ]);
    return signature.toString('hex');
}

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
    let holder1: SignerWithAddress;
    let holder2: SignerWithAddress;
    let holder3: SignerWithAddress;
    let attacker: SignerWithAddress;

    beforeEach(async function() {
        [ owner, holder1, holder2, holder3, attacker ] = await ethers.getSigners();

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

        tx = await lord.transferOwnership(tube.address);
        await tx.wait();

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
        await expect(tube.addValidator(VALIDATOR_ADDRESSES[0]))
            .to.be.revertedWith('not paused');

        await tube.pause();
        await expect(tube.addValidator(VALIDATOR_ADDRESSES[0]))
            .to.emit(tube, "ValidatorAdded")
            .withArgs(VALIDATOR_ADDRESSES[0]);

        expect(await tube.numOfValidators()).to.equal(1);

        await expect(tube.removeValidator(VALIDATOR_ADDRESSES[0]))
            .to.emit(tube, "ValidatorRemoved")
            .withArgs(VALIDATOR_ADDRESSES[0]);

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
            await expect(tube.addValidator(VALIDATOR_ADDRESSES[0]))
                .to.emit(tube, "ValidatorAdded")
                .withArgs(VALIDATOR_ADDRESSES[0]);

            await expect(tube.addValidator(VALIDATOR_ADDRESSES[1]))
                .to.emit(tube, "ValidatorAdded")
                .withArgs(VALIDATOR_ADDRESSES[1]);

            await expect(tube.addValidator(VALIDATOR_ADDRESSES[2]))
                .to.emit(tube, "ValidatorAdded")
                .withArgs(VALIDATOR_ADDRESSES[2]);

            await tube.unpause();
        });

        it('amount is 0', async function() {
            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, holder1.address, 0, ZERO_THREE_SIGNATURES))
                .to.be.revertedWith('amount is 0');
        });

        it('invalid recipient', async function() {
            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, ZERO_ADDRESS, 1000, ZERO_THREE_SIGNATURES))
                .to.be.revertedWith('invalid recipient');
        });

        it('invalid signature length', async function() {
            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, holder1.address, 1000, 0x00))
                .to.be.revertedWith('invalid signature length');
        });

        it('invalid tubeId and token', async function() {
            await expect(tube.withdraw(CHAIN_ID, holder3.address, 0, holder1.address, 1000, ZERO_THREE_SIGNATURES))
                .to.be.revertedWith('invalid tubeId and token');
        });

        it('invalid validator', async function() {
            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, holder1.address, 1000, ZERO_THREE_SIGNATURES))
                .to.be.revertedWith('invalid validator');
        });

        it('duplicate validators', async function() {
            const key = await tube.genKey(
                CHAIN_ID,
                srcToken.address,
                0,
                holder1.address,
                1000
            );

            const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0]);
            const signature = '0x' + s1 + s1;

            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, holder1.address, 1000, signature))
                .to.be.revertedWith('duplicate validator');
        });

        it('insufficient validators', async function() {
            const key = await tube.genKey(
                CHAIN_ID,
                srcToken.address,
                0,
                holder1.address,
                1000
            );

            const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0]);
            const signature = '0x' + s1;

            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, holder1.address, 1000, signature))
                .to.be.revertedWith('insufficient validators');
        });

        it('success', async function() {
            const key = await tube.genKey(
                CHAIN_ID,
                srcToken.address,
                0,
                holder1.address,
                1000
            );

            const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0]);
            const s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1]);
            const s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2]);
            const signature = '0x' + s1 + s2 + s3;

            await expect(tube.withdraw(CHAIN_ID, srcToken.address, 0, holder1.address, 1000, signature))
                .to.emit(tube, "Settled")
                .withArgs(key, VALIDATOR_ADDRESSES);
        });
    });

    describe('withdrawInBatch', function() {
        beforeEach(async function() {
            await tube.pause();
            await expect(tube.addValidator(VALIDATOR_ADDRESSES[0]))
                .to.emit(tube, "ValidatorAdded")
                .withArgs(VALIDATOR_ADDRESSES[0]);

            await expect(tube.addValidator(VALIDATOR_ADDRESSES[1]))
                .to.emit(tube, "ValidatorAdded")
                .withArgs(VALIDATOR_ADDRESSES[1]);

            await expect(tube.addValidator(VALIDATOR_ADDRESSES[2]))
                .to.emit(tube, "ValidatorAdded")
                .withArgs(VALIDATOR_ADDRESSES[2]);

            await tube.unpause();
        });

        it('invalid array length', async function() {
            await expect(
                tube.withdrawInBatch(
                    [],
                    [],
                    [],
                    [],
                    [],
                    ZERO_THREE_SIGNATURES
                )
            )
            .to.be.revertedWith('invalid array length');
        });

        it('invalid signature length', async function() {
            await expect(
                tube.withdrawInBatch(
                    [ CHAIN_ID ],
                    [ srcToken.address ],
                    [ 0 ],
                    [ holder1.address ],
                    [ 100 ],
                    '0x00'
                )
            )
            .to.be.revertedWith('invalid signature length');
        });

        it('invalid parameters', async function() {
            await expect(
                tube.withdrawInBatch(
                    [ CHAIN_ID ],
                    [ srcToken.address ],
                    [],
                    [ holder1.address ],
                    [ 100 ],
                    ZERO_THREE_SIGNATURES
                )
            )
            .to.be.revertedWith('invalid parameters');
        });

        it('invalid tubeId and token', async function() {
            await expect(
                tube.withdrawInBatch(
                    [ CHAIN_ID ],
                    [ holder1.address ],
                    [ 0 ],
                    [ holder1.address ],
                    [ 100 ],
                    ZERO_THREE_SIGNATURES
                )
            )
            .to.be.revertedWith('invalid tubeId and token');
        });

        it('amount is 0', async function() {
            await expect(
                tube.withdrawInBatch(
                    [ CHAIN_ID ],
                    [ srcToken.address ],
                    [ 0 ],
                    [ holder1.address ],
                    [ 0 ],
                    ZERO_THREE_SIGNATURES
                )
            )
            .to.be.revertedWith('amount is 0');
        });

        it('invalid recipient', async function() {
            await expect(
                tube.withdrawInBatch(
                    [ CHAIN_ID ],
                    [ srcToken.address ],
                    [ 0 ],
                    [ ZERO_ADDRESS ],
                    [ 100 ],
                    ZERO_THREE_SIGNATURES
                )
            )
            .to.be.revertedWith('invalid recipient');
        });

        it('invalid validator', async function() {
            await expect(
                tube.withdrawInBatch(
                    [ CHAIN_ID ],
                    [ srcToken.address ],
                    [ 0 ],
                    [ holder1.address ],
                    [ 100 ],
                    ZERO_THREE_SIGNATURES
                )
            )
            .to.be.revertedWith('invalid validator');
        });

        it('insufficient validators', async function() {
            const key1 = await tube.genKey(
                CHAIN_ID,
                srcToken.address,
                0,
                holder1.address,
                1000
            );

            const key2 = await tube.genKey(
                CHAIN_ID,
                srcToken.address,
                0,
                holder2.address,
                200
            );

            const key = await tube.concatKeys([ key1, key2 ]);

            const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0]);
            const signature = '0x' + s1;

            await expect(
                tube.withdrawInBatch(
                    [ CHAIN_ID, CHAIN_ID ],
                    [ srcToken.address, srcToken.address ],
                    [ 0, 0 ],
                    [ holder1.address, holder2.address ],
                    [ 1000, 200 ],
                    signature
                )
            )
            .to.be.revertedWith('insufficient validators');
        });

        it('duplicate validator', async function() {
            const key1 = await tube.genKey(
                CHAIN_ID,
                srcToken.address,
                0,
                holder1.address,
                1000
            );

            const key2 = await tube.genKey(
                CHAIN_ID,
                srcToken.address,
                0,
                holder2.address,
                200
            );

            const key = await tube.concatKeys([ key1, key2 ]);

            const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0]);
            const signature = '0x' + s1 + s1;

            await expect(
                tube.withdrawInBatch(
                    [ CHAIN_ID, CHAIN_ID ],
                    [ srcToken.address, srcToken.address ],
                    [ 0, 0 ],
                    [ holder1.address, holder2.address ],
                    [ 1000, 200 ],
                    signature
                )
            )
            .to.be.revertedWith('duplicate validator');
        });

        it('success', async function() {
            const key1 = await tube.genKey(
                CHAIN_ID,
                srcToken.address,
                0,
                holder1.address,
                1000
            );

            const key2 = await tube.genKey(
                CHAIN_ID,
                srcToken.address,
                0,
                holder2.address,
                200
            );

            const key = await tube.concatKeys([ key1, key2 ]);

            const s1 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[0]);
            const s2 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[1]);
            const s3 = sign(key.slice(2), VALIDATOR_PRIVATE_KEYS[2]);
            const signature = '0x' + s1 + s2 + s3;

            await expect(
                tube.withdrawInBatch(
                    [ CHAIN_ID, CHAIN_ID ],
                    [ srcToken.address, srcToken.address ],
                    [ 0, 0 ],
                    [ holder1.address, holder2.address ],
                    [ 1000, 200 ],
                    signature
                )
            )
            .to.emit(tube, "Settled")
            .withArgs(key1, VALIDATOR_ADDRESSES)
            .to.emit(tube, "Settled")
            .withArgs(key2, VALIDATOR_ADDRESSES);
        });
    });
});
