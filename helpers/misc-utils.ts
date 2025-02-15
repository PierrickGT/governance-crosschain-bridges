import BigNumber from 'bignumber.js';
import BN = require('bn.js');
// import low from 'lowdb';
// import FileSync from 'lowdb/adapters/FileSync';
import { WAD } from './constants';
import { Wallet, ContractTransaction, Signer } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { tEthereumAddress } from './types';
import { isAddress } from 'ethers/lib/utils';
import { isZeroAddress } from 'ethereumjs-util';

export const toWad = (value: string | number) => new BigNumber(value).times(WAD).toFixed();

export const bnToBigNumber = (amount: BN): BigNumber => new BigNumber(<any>amount);
export const stringToBigNumber = (amount: string): BigNumber => new BigNumber(amount);

// export const getDb = () => low(new FileSync('./deployed-contracts.json'));

export let DRE: HardhatRuntimeEnvironment;

export const setDRE = (_DRE: HardhatRuntimeEnvironment) => {
  DRE = _DRE;
};

export const sleep = (milliseconds: number) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const createRandomAddress = () => Wallet.createRandom().address;

export const evmSnapshot = async () => await DRE.ethers.provider.send('evm_snapshot', []);

export const evmRevert = async (id: string) => DRE.ethers.provider.send('evm_revert', [id]);

export const timeLatest = async () => {
  const block = await DRE.ethers.provider.getBlock('latest');
  return new BigNumber(block.timestamp);
};

export const advanceBlock = async (timestamp: number) =>
  await DRE.ethers.provider.send('evm_mine', [timestamp]);

export const increaseTime = async (secondsToIncrease: number) => {
  await DRE.ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
  await DRE.ethers.provider.send('evm_mine', []);
};

// Workaround for time travel tests bug: https://github.com/Tonyhaenn/hh-time-travel/blob/0161d993065a0b7585ec5a043af2eb4b654498b8/test/test.js#L12
export const advanceTimeAndBlock = async function (forwardTime: number) {
  const currentBlockNumber = await DRE.ethers.provider.getBlockNumber();
  const currentBlock = await DRE.ethers.provider.getBlock(currentBlockNumber);

  if (currentBlock === null) {
    /* Workaround for https://github.com/nomiclabs/hardhat/issues/1183
     */
    await DRE.ethers.provider.send('evm_increaseTime', [forwardTime]);
    await DRE.ethers.provider.send('evm_mine', []);
    //Set the next blocktime back to 15 seconds
    await DRE.ethers.provider.send('evm_increaseTime', [15]);
    return;
  }
  const currentTime = currentBlock.timestamp;
  const futureTime = currentTime + forwardTime;
  await DRE.ethers.provider.send('evm_setNextBlockTimestamp', [futureTime]);
  await DRE.ethers.provider.send('evm_mine', []);
};

export const latestBlock = async () => await DRE.ethers.provider.getBlockNumber();

export const advanceBlockTo = async (target: number) => {
  const currentBlock = await latestBlock();
  const start = Date.now();
  let notified;
  let increase = 10;
  if (target < currentBlock)
    throw Error(`Target block #(${target}) is lower than current block #(${currentBlock})`);
  while ((await latestBlock()) < target) {
    if (!notified && Date.now() - start >= 5000) {
      notified = true;
      console.log(`advanceBlockTo: Advancing too many blocks is causing this test to be slow.'`);
    }
    await advanceBlock(start + increase);
    increase += 10;
  }
};

export const waitForTx = async (tx: ContractTransaction) => await tx.wait(1);

export const filterMapBy = (raw: { [key: string]: any }, fn: (key: string) => boolean) =>
  Object.keys(raw)
    .filter(fn)
    .reduce<{ [key: string]: any }>((obj, key) => {
      obj[key] = raw[key];
      return obj;
    }, {});

export const chunk = <T>(arr: Array<T>, chunkSize: number): Array<Array<T>> => {
  return arr.reduce(
    (prevVal: any, currVal: any, currIndx: number, array: Array<T>) =>
      !(currIndx % chunkSize)
        ? prevVal.concat([array.slice(currIndx, currIndx + chunkSize)])
        : prevVal,
    []
  );
};

interface DbEntry {
  [network: string]: {
    deployer: string;
    address: string;
  };
}

export const getImpersonatedSigner = async (address: tEthereumAddress): Promise<Signer> => {
  await DRE.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  return await DRE.ethers.getSigner(address);
};
// export const printContracts = () => {
//   const network = DRE.network.name;
//   const db = getDb();
//   console.log('Contracts deployed at', network);
//   console.log('---------------------------------');

//   const entries = Object.entries<DbEntry>(db.getState()).filter(([_k, value]) => !!value[network]);

//   const contractsPrint = entries.map(
//     ([key, value]: [string, DbEntry]) => `${key}: ${value[network].address}`
//   );

//   console.log('N# Contracts:', entries.length);
//   console.log(contractsPrint.join('\n'), '\n');
// };

export const notFalsyOrZeroAddress = (address: tEthereumAddress | null | undefined): boolean => {
  if (!address) {
    return false;
  }
  return isAddress(address) && !isZeroAddress(address);
};
