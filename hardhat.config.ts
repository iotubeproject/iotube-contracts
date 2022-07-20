import "@typechain/hardhat"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
import "@openzeppelin/hardhat-upgrades"
import "solidity-coverage"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer"
import "dotenv/config"

const MAINNET_RPC_URL =
  process.env.MAINNET_RPC_URL ||
  process.env.ALCHEMY_MAINNET_RPC_URL ||
  "https://eth-mainnet.alchemyapi.io/v2/your-api-key"
const FORKING_BLOCK_NUMBER = process.env.FORKING_BLOCK_NUMBER || "0"
const PRIVATE_KEY = process.env.PRIVATE_KEY
const REPORT_GAS = process.env.REPORT_GAS || false

const accounts = [
  process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000",
]

export default {
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: MAINNET_RPC_URL,
        blockNumber: Number(FORKING_BLOCK_NUMBER),
        enabled: false,
      },
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts,
    },
    mainnet: {
      url: MAINNET_RPC_URL,
      accounts: accounts,
      saveDeployments: true,
      chainId: 1,
    },
    iotex: {
        url: 'https://babel-api.mainnet.iotex.io',
        accounts: accounts,
        chainId: 4689,
    },
    iotex_test: {
        url: 'https://babel-api.testnet.iotex.io',
        accounts: accounts,
        chainId: 4690,
    },
    avax_test: {
        url: 'https://api.avax-test.network/ext/bc/C/rpc',
        accounts: accounts,
        chainId: 43113,
    },
    bsc: {
        url: 'https://bsc-dataseed.binance.org',
        accounts: accounts,
        chainId: 56,
    },
    polygon: {
        url: 'https://polygon-rpc.com/',
        accounts: accounts,
        chainId: 137,
    },
  },
  solidity: {
    compilers: [{
      version: "0.7.6",
      settings: {
        optimizer: {
          enabled: true,
          runs: 800,
        },
        metadata: {
          bytecodeHash: "none",
        },
      },
    }, {
      version: "0.8.7",
      settings: {
        optimizer: {
          enabled: true,
          runs: 800,
        },
        metadata: {
          bytecodeHash: "none",
        },
      },
    }]
  },
  mocha: {
    timeout: 200000,
  },
  paths: {
    artifacts: "artifacts",
    cache: "cache",
    deploy: "deploy",
    deployments: "deployments",
    imports: "imports",
    sources: "contracts",
    tests: "test",
  },
  typechain: {
    outDir: "types",
  },
  etherscan: {
    apiKey: `${process.env.ETHERSCAN_API_KEY}`,
    customChains: [{
      network: "iotex",
      chainId: 4689,
      urls: {
        apiURL: "https://iotexscout.io/api",
        browserURL: "https://iotexscout.io"
      }
    }, {
      network: "iotex_test",
      chainId: 4690,
      urls: {
        apiURL: "https://testnet.iotexscout.io/api",
        browserURL: "https://testnet.iotexscout.io"
      }
    }]
  },
  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  contractSizer: {
    runOnCompile: false,
    only: ["ExampleToken"],
  },
}
