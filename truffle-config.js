module.exports = {
  plugins: ['truffle-security'],
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
      gas: 8000000,
      gasPrice: 1,
    },
  },

  compilers: {
    solc: {
      version: '0.5.10',
      settings: {
        optimizer: {
          enabled: true,
          // runs: 200, // used in presentation
          runs: 10000, // a bit more optimized
        },
        evmVersion: 'constantinople',
      },
    },
  },
};
