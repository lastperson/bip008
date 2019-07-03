'use strict';

const util = require('ethereumjs-util');

const Identity = artifacts.require('Identity');
const Controller = artifacts.require('Controller');
const Factory = artifacts.require('Factory');

const IdentityPrototype = artifacts.require('IdentityPrototype');
const ControllerPrototype = artifacts.require('ControllerPrototype');
const CloneFactory = artifacts.require('CloneFactory');

const CloneConstantFactory = artifacts.require('CloneConstantFactory');

const EVMCloneFactory = artifacts.require('EVMCloneFactory');


contract('BIP008', (accounts) => {
  web3.defaultGasPrice = 1;

  const OWNER_PRIVATE_KEY = util.toBuffer('0x69b39aa2fb86c7172d77d4b87b459ed7643c1e4b052536561e08d7d25592b373');
  const OWNER = accounts[0];
  const RECOVERY = accounts[1];
  const RECEIVER = accounts[2];
  const DATA = '0x12345678';

  const replaceAll = (input, find, replace) => {
    return input.split(find).join(replace);
  };

  const calculateContractAddress = (sender, nonce) => {
    const senderBuf = util.toBuffer(sender);
    return util.addHexPrefix(
      util.rlphash([senderBuf, nonce])
      .toString('hex')
      .slice(24)
    );
  };

  const prepareForwardOnBehalf = (destination, value, data, controller, nonce,
    sender) => {
    return util.sha3(Buffer.concat([
      util.toBuffer(destination),
      util.setLengthLeft(value, 32),
      util.toBuffer(data),
      util.toBuffer(controller),
      util.setLengthLeft(nonce, 12),
      util.toBuffer(sender),
    ]));
  };

  const getBalance = async (address) => {
    return web3.utils.toBN(await web3.eth.getBalance(address));
  };

  const gasUsed = async (promiseFunc, name, multiplier = 13, divisor = 1) => {
    const mult = web3.utils.toBN(multiplier);
    const div = web3.utils.toBN(divisor);
    const balanceBefore = await getBalance(OWNER);
    const result = await promiseFunc();
    const gasResult = balanceBefore.sub(await getBalance(OWNER)).div(div);
    console.log(`${name} gas used: ${gasResult.toString()} ${web3.utils.fromWei(gasResult.mul(mult), 'gwei')} ETH`);
    return result;
  };

  let CloneConstantFactoryBytecode;
  let EVMCloneFactoryBytecode;

  before('Setup', () => {
    CloneConstantFactoryBytecode = CloneConstantFactory._json.bytecode;
    EVMCloneFactoryBytecode = EVMCloneFactory._json.bytecode;
  });

  afterEach('Cleanup', () => {
    CloneConstantFactory._json.bytecode = CloneConstantFactoryBytecode;
    EVMCloneFactory._json.bytecode = EVMCloneFactoryBytecode;
  });

  it('Version 0', async function() {
    const identity = await gasUsed(() => Identity.new(OWNER), 'Identity deploy');
    const controller = await gasUsed(() => Controller.new(OWNER, identity.address, RECOVERY), 'Controller deploy');
    await gasUsed(() => identity.changeContractOwnership(controller.address), 'Change ownership');

    const hash = prepareForwardOnBehalf(RECEIVER, 0, DATA, controller.address, 0, OWNER);
    const signature = util.ecsign(hash, OWNER_PRIVATE_KEY);
    await gasUsed(() => controller.forwardOnBehalf(
      RECEIVER, 0, DATA, 0, signature.v, util.bufferToHex(signature.r), util.bufferToHex(signature.s)), 'Forward on behalf');
  });

  it('Version 1', async function() {
    const factory = await Factory.new();
    const identity = await gasUsed(async () => {
      const {logs} = await factory.deployIdentity(OWNER);
      return Identity.at(logs[0].args.newContract);
    }, 'Identity deploy');
    const controller = await gasUsed(async () => {
      const {logs} = await factory.deployController(OWNER, identity.address, RECOVERY);
      return Controller.at(logs[0].args.newContract);
    }, 'Controller deploy');
    await gasUsed(() => identity.changeContractOwnership(controller.address), 'Change ownership');

    const hash = prepareForwardOnBehalf(RECEIVER, 0, DATA, controller.address, 0, OWNER);
    const signature = util.ecsign(hash, OWNER_PRIVATE_KEY);
    await gasUsed(() => controller.forwardOnBehalf(
      RECEIVER, 0, DATA, 0, signature.v, util.bufferToHex(signature.r), util.bufferToHex(signature.s)), 'Forward on behalf');
  });

  it('Version 2', async function() {
    const identityPrototype = await IdentityPrototype.new();
    const controllerPrototype = await ControllerPrototype.new();
    const factory = await CloneFactory.new(identityPrototype.address, controllerPrototype.address);
    const identity = await gasUsed(async () => {
      const {logs} = await factory.deployIdentity(OWNER);
      return Identity.at(logs[0].args.newContract);
    }, 'Identity deploy');
    const controller = await gasUsed(async () => {
      const {logs} = await factory.deployController(OWNER, identity.address, RECOVERY);
      return Controller.at(logs[0].args.newContract);
    }, 'Controller deploy');
    await gasUsed(() => identity.changeContractOwnership(controller.address), 'Change ownership');

    const hash = prepareForwardOnBehalf(RECEIVER, 0, DATA, controller.address, 0, OWNER);
    const signature = util.ecsign(hash, OWNER_PRIVATE_KEY);
    await gasUsed(() => controller.forwardOnBehalf(
      RECEIVER, 0, DATA, 0, signature.v, util.bufferToHex(signature.r), util.bufferToHex(signature.s)), 'Forward on behalf');
  });

  it('Version 3', async function() {
    const identityPrototype = await IdentityPrototype.new();
    const controllerPrototype = await ControllerPrototype.new();
    CloneConstantFactory._json.bytecode = await replaceAll(
      CloneConstantFactory._json.bytecode,
      'cafecafecafecafecafecafecafecafecafecafe',
      identityPrototype.address.slice(-40)
    );
    CloneConstantFactory._json.bytecode = await replaceAll(
      CloneConstantFactory._json.bytecode,
      'beefbeefbeefbeefbeefbeefbeefbeefbeefbeef',
      controllerPrototype.address.slice(-40)
    );
    const factory = await CloneConstantFactory.new();
    const identity = await gasUsed(async () => {
      const {logs} = await factory.deployIdentity(OWNER);
      return Identity.at(logs[0].args.newContract);
    }, 'Identity deploy');
    const controller = await gasUsed(async () => {
      const {logs} = await factory.deployController(OWNER, identity.address, RECOVERY);
      return Controller.at(logs[0].args.newContract);
    }, 'Controller deploy');
    await gasUsed(() => identity.changeContractOwnership(controller.address), 'Change ownership');

    const hash = prepareForwardOnBehalf(RECEIVER, 0, DATA, controller.address, 0, OWNER);
    const signature = util.ecsign(hash, OWNER_PRIVATE_KEY);
    await gasUsed(() => controller.forwardOnBehalf(
      RECEIVER, 0, DATA, 0, signature.v, util.bufferToHex(signature.r), util.bufferToHex(signature.s)), 'Forward on behalf');
  });

  it('Version 4', async function() {
    const identityPrototype = await IdentityPrototype.new();
    const controllerPrototype = await ControllerPrototype.new();
    CloneConstantFactory._json.bytecode = await replaceAll(
      CloneConstantFactory._json.bytecode,
      'cafecafecafecafecafecafecafecafecafecafe',
      identityPrototype.address.slice(-40)
    );
    CloneConstantFactory._json.bytecode = await replaceAll(
      CloneConstantFactory._json.bytecode,
      'beefbeefbeefbeefbeefbeefbeefbeefbeefbeef',
      controllerPrototype.address.slice(-40)
    );
    const factory = await CloneConstantFactory.new();
    const controller = await gasUsed(async () => {
      const {logs} = await factory.deployPair(OWNER, RECOVERY);
      return Controller.at(logs[0].args.newContract);
    }, 'Identity deploy, Controller deploy, Change ownership');

    const hash = prepareForwardOnBehalf(RECEIVER, 0, DATA, controller.address, 0, OWNER);
    const signature = util.ecsign(hash, OWNER_PRIVATE_KEY);
    await gasUsed(() => controller.forwardOnBehalf(
      RECEIVER, 0, DATA, 0, signature.v, util.bufferToHex(signature.r), util.bufferToHex(signature.s)), 'Forward on behalf');
  });

  it('Version 5', async function() {
    const identityPrototype = await IdentityPrototype.new();
    const controllerPrototype = await ControllerPrototype.new();
    CloneConstantFactory._json.bytecode = await replaceAll(
      CloneConstantFactory._json.bytecode,
      'cafecafecafecafecafecafecafecafecafecafe',
      identityPrototype.address.slice(-40)
    );
    CloneConstantFactory._json.bytecode = await replaceAll(
      CloneConstantFactory._json.bytecode,
      'beefbeefbeefbeefbeefbeefbeefbeefbeefbeef',
      controllerPrototype.address.slice(-40)
    );
    const factory = await CloneConstantFactory.new();
    const controller = await gasUsed(async () => {
      const {logs} = await factory.deployPair(OWNER, RECOVERY);
      return Controller.at(logs[0].args.newContract);
    }, 'Identity deploy, Controller deploy, Change ownership', 1);

    await gasUsed(() => controller.changeContractOwnership(OWNER), 'Assign controller');
    const hash = prepareForwardOnBehalf(RECEIVER, 0, DATA, controller.address, 0, OWNER);
    const signature = util.ecsign(hash, OWNER_PRIVATE_KEY);
    await gasUsed(() => controller.forwardOnBehalf(
      RECEIVER, 0, DATA, 0, signature.v, util.bufferToHex(signature.r), util.bufferToHex(signature.s)), 'Forward on behalf');
  });

  it('Version 6', async function() {
    const identityPrototype = await IdentityPrototype.new();
    const controllerPrototype = await ControllerPrototype.new();
    EVMCloneFactory._json.bytecode = await replaceAll(
      EVMCloneFactory._json.bytecode,
      'cafecafecafecafecafecafecafecafecafecafe',
      identityPrototype.address.slice(-40)
    );
    EVMCloneFactory._json.bytecode = await replaceAll(
      EVMCloneFactory._json.bytecode,
      'beefbeefbeefbeefbeefbeefbeefbeefbeefbeef',
      controllerPrototype.address.slice(-40)
    );
    const factory = await EVMCloneFactory.new();
    const controller = await gasUsed(async () => {
      const {logs} = await factory.deployPair(OWNER, RECOVERY);
      return Controller.at(logs[0].args.newContract);
    }, 'Identity deploy, Controller deploy, Change ownership', 1);

    await gasUsed(() => controller.changeContractOwnership(OWNER), 'Assign controller');
    const hash = prepareForwardOnBehalf(RECEIVER, 0, DATA, controller.address, 0, OWNER);
    const signature = util.ecsign(hash, OWNER_PRIVATE_KEY);
    await gasUsed(() => controller.forwardOnBehalf(
      RECEIVER, 0, DATA, 0, signature.v, util.bufferToHex(signature.r), util.bufferToHex(signature.s)), 'Forward on behalf');
  });

  it('Version 7', async function() {
    const identityPrototype = await IdentityPrototype.new();
    const controllerPrototype = await ControllerPrototype.new();
    EVMCloneFactory._json.bytecode = await replaceAll(
      EVMCloneFactory._json.bytecode,
      'cafecafecafecafecafecafecafecafecafecafe',
      identityPrototype.address.slice(-40)
    );
    EVMCloneFactory._json.bytecode = await replaceAll(
      EVMCloneFactory._json.bytecode,
      'beefbeefbeefbeefbeefbeefbeefbeefbeefbeef',
      controllerPrototype.address.slice(-40)
    );
    const factory = await EVMCloneFactory.new();
    const controller = await gasUsed(async () => {
      await factory.deployPairNoEvent(OWNER, RECOVERY);
      return Controller.at(calculateContractAddress(factory.address, 2));
    }, 'Identity deploy, Controller deploy, Change ownership', 1);

    await gasUsed(() => controller.changeContractOwnership(OWNER), 'Assign controller');
    const hash = prepareForwardOnBehalf(RECEIVER, 0, DATA, controller.address, 0, OWNER);
    const signature = util.ecsign(hash, OWNER_PRIVATE_KEY);
    await gasUsed(() => controller.forwardOnBehalf(
      RECEIVER, 0, DATA, 0, signature.v, util.bufferToHex(signature.r), util.bufferToHex(signature.s)), 'Forward on behalf');
  });

  it('Version 8', async function() {
    const identityPrototype = await IdentityPrototype.new();
    const controllerPrototype = await ControllerPrototype.new();
    EVMCloneFactory._json.bytecode = await replaceAll(
      EVMCloneFactory._json.bytecode,
      'cafecafecafecafecafecafecafecafecafecafe',
      identityPrototype.address.slice(-40)
    );
    EVMCloneFactory._json.bytecode = await replaceAll(
      EVMCloneFactory._json.bytecode,
      'beefbeefbeefbeefbeefbeefbeefbeefbeefbeef',
      controllerPrototype.address.slice(-40)
    );
    const factory = await EVMCloneFactory.new();
    const controller = await gasUsed(async () => {
      await factory.deployMulti(RECOVERY, {gas: 8000000});
      return Controller.at(calculateContractAddress(factory.address, 2));
    }, 'Identity deploy, Controller deploy, Change ownership', 1, 40);

    await gasUsed(() => controller.changeContractOwnership(OWNER), 'Assign controller');
    const hash = prepareForwardOnBehalf(RECEIVER, 0, DATA, controller.address, 0, OWNER);
    const signature = util.ecsign(hash, OWNER_PRIVATE_KEY);
    await gasUsed(() => controller.forwardOnBehalf(
      RECEIVER, 0, DATA, 0, signature.v, util.bufferToHex(signature.r), util.bufferToHex(signature.s)), 'Forward on behalf');
  });
});
