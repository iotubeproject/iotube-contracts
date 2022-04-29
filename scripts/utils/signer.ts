import { ethers, network } from "hardhat"

async function main() {
    const [deployer] = await ethers.getSigners()

    const srcTubeId = process.env.SRC_TUBE_ID || "0"
    const nonce = process.env.NONCE || "1"
    const token = process.env.TOKEN || "0x70be56907d3f8dc1eda0a6f860f3a3d4b4162796"
    const recipient = process.env.RECIPIENT || "0x8896780a7912829781f70344Ab93E589dDdb2930"
    const tubeId = process.env.TUBE_ID || "0"
    const amount = process.env.AMOUNT || ethers.utils.parseEther("1").toString()

    const key = ethers.utils.solidityKeccak256(
        ["uint256", "uint256", "uint256", "address", "uint256", "address"],
        [srcTubeId, nonce, tubeId, token, amount, recipient]
    )

    const privateKey = process.env.PRIVATE_KEY
    const wallet = new ethers.Wallet(privateKey!)
    const signature = ethers.utils.joinSignature(wallet._signingKey().signDigest(key))
    console.log(signature)
}

main()
  .then(() => process.exit(0))
  .catch((error) => { 
    console.error(error)
    process.exit(1)
  })
