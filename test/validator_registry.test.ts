import _ from "lodash"
import { ethers } from "hardhat"
import { expect } from "chai"
import { Contract } from "@ethersproject/contracts"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ecsign, toBuffer, setLengthLeft } from "ethereumjs-util"

const privateKeyToAddress = require("ethereum-private-key-to-address")

// TODO: add unit test for validator registry