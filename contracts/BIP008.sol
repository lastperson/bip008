pragma solidity 0.5.10;


contract Owned {
    address public contractOwner;

    event ContractOwnerChanged(address newContractOwner);

    constructor(address _owner) public {
        contractOwner = _owner;
    }

    modifier onlyContractOwner() {
        require(contractOwner == msg.sender, 'Not a contract owner');
        _;
    }

    function changeContractOwnership(address _to) public onlyContractOwner() returns(bool) {
        contractOwner = _to;
        emit ContractOwnerChanged(_to);
        return true;
    }
}


contract Identity is Owned {
    constructor(address _owner) Owned(_owner) public {}

    function forward(address payable _to, uint _value, bytes memory _data)
        public
        onlyContractOwner()
        returns(bytes memory)
    {
        (bool success, bytes memory result) = _to.call.value(_value)(_data);
        require(success, string(result));
        return result;
    }

    function () external payable {}
}


contract Controller is Owned {
    Identity public identity;
    uint96 public nonce;

    address public recovery;

    constructor(address _owner, Identity _identity, address _recovery) public Owned(_owner) {
        identity = _identity;
        recovery = _recovery;
    }

    function _forward(address payable _to, uint _value, bytes memory _data) internal returns(bytes memory) {
        return identity.forward(_to, _value, _data);
    }

    function forwardOnBehalf(
        address payable _to,
        uint _value,
        bytes memory _data,
        uint96 _nonce,
        uint8 _v,
        bytes32 _r,
        bytes32 _s)
    public returns(bytes memory) {
        bytes32 hash = keccak256(abi.encodePacked(_to, _value, _data, address(this), _nonce, msg.sender));
        address signer = ecrecover(hash, _v, _r, _s);
        require(signer == contractOwner, 'Not a contract owner');
        require(_nonce == nonce++, 'Invalid nonce');
        return _forward(_to, _value, _data);
    }

    function forward(address payable _to, uint _value, bytes memory _data)
        public
        onlyContractOwner()
        returns(bytes memory)
    {
        return _forward(_to, _value, _data);
    }

    function recover(address _newOwner) public returns(bool) {
        require (msg.sender == recovery, 'Not a recovery');
        contractOwner = _newOwner;
        emit ContractOwnerChanged(_newOwner);
        return true;
    }
}


contract Factory {
    event Deployed(address newContract);

    function deployIdentity(address _owner) public {
        emit Deployed(address(new Identity(_owner)));
    }

    function deployController(address _owner, Identity _identity, address _recovery) public {
        emit Deployed(address(new Controller(_owner, _identity, _recovery)));
    }
}


contract OwnedPrototype {
    address public contractOwner;

    event ContractOwnerChanged(address newContractOwner);

    constructor() public {
        contractOwner = 0x0000000000000000000000000000000000000001;
    }

    function constructOwned(address _owner) public {
        require(contractOwner == address(0), 'Already constructed');
        contractOwner = _owner;
    }

    modifier onlyContractOwner() {
        require(contractOwner == msg.sender, 'Not a contract owner');
        _;
    }

    function changeContractOwnership(address _to) public onlyContractOwner() returns(bool) {
        contractOwner = _to;
        emit ContractOwnerChanged(_to);
        return true;
    }
}


contract IdentityPrototype is OwnedPrototype {
    function forward(address payable _to, uint _value, bytes memory _data)
        public
        onlyContractOwner()
        returns(bytes memory)
    {
        (bool success, bytes memory result) = _to.call.value(_value)(_data);
        require(success, string(result));
        return result;
    }

    function () external payable {}
}


contract ControllerPrototype is OwnedPrototype {
    Identity public identity;
    uint96 public nonce;

    address public recovery;

    constructor() public {
        identity = Identity(0x0000000000000000000000000000000000000001);
        recovery = 0x0000000000000000000000000000000000000001;
    }

    function constructController(address _owner, Identity _identity, address _recovery) public {
        constructOwned(_owner);
        identity = _identity;
        recovery = _recovery;
    }

    function _forward(address payable _to, uint _value, bytes memory _data) internal returns(bytes memory) {
        return identity.forward(_to, _value, _data);
    }

    function forwardOnBehalf(
        address payable _to,
        uint _value,
        bytes memory _data,
        uint96 _nonce,
        uint8 _v,
        bytes32 _r,
        bytes32 _s)
    public returns(bytes memory) {
        bytes32 hash = keccak256(abi.encodePacked(_to, _value, _data, address(this), _nonce, msg.sender));
        address signer = ecrecover(hash, _v, _r, _s);
        require(signer == contractOwner, 'Not a contract owner');
        require(_nonce == nonce++, 'Invalid nonce');
        return _forward(_to, _value, _data);
    }

    function forward(address payable _to, uint _value, bytes memory _data)
        public
        onlyContractOwner()
        returns(bytes memory)
    {
        return _forward(_to, _value, _data);
    }

    function recover(address _newOwner) public returns(bool) {
        require (msg.sender == recovery, 'Not a recovery');
        contractOwner = _newOwner;
        emit ContractOwnerChanged(_newOwner);
        return true;
    }
}

contract Clone {
    constructor(address _prototype) public {
        assembly {
            sstore(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, _prototype)
        }
    }
    function () external payable {
        assembly {
            let proto := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
            calldatacopy(0, 0, calldatasize)
            let res := delegatecall(gas, proto, 0, calldatasize, 0, 0)
            returndatacopy(0, 0, returndatasize)
            switch res case 0 { revert(0, returndatasize) } default { return(0, returndatasize) }
        }
    }
}


contract CloneFactory {
    address public identityPrototype;
    address public controllerPrototype;

    event Deployed(address newContract);

    constructor(address _identityPrototype, address _controllerPrototype) public {
        identityPrototype = _identityPrototype;
        controllerPrototype = _controllerPrototype;
    }

    function deployIdentity(address _owner) public {
        address payable deployed = address(new Clone(identityPrototype));
        IdentityPrototype(deployed).constructOwned(_owner);
        emit Deployed(deployed);
    }

    function deployController(address _owner, Identity _identity, address _recovery) public {
        address deployed = address(new Clone(controllerPrototype));
        ControllerPrototype(deployed).constructController(_owner, _identity, _recovery);
        emit Deployed(deployed);
    }
}


contract CloneIdentity {
    function () external payable {
        address PROTOTYPE = 0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe;
        assembly {
            calldatacopy(0, 0, calldatasize)
            let res := delegatecall(gas, PROTOTYPE, 0, calldatasize, 0, 0)
            returndatacopy(0, 0, returndatasize)
            switch res case 0 { revert(0, returndatasize) } default { return(0, returndatasize) }
        }
    }
}

contract CloneController {
    function () external payable {
        address PROTOTYPE = 0xBEeFbeefbEefbeEFbeEfbEEfBEeFbeEfBeEfBeef;
        assembly {
            calldatacopy(0, 0, calldatasize)
            let res := delegatecall(gas, PROTOTYPE, 0, calldatasize, 0, 0)
            returndatacopy(0, 0, returndatasize)
            switch res case 0 { revert(0, returndatasize) } default { return(0, returndatasize) }
        }
    }
}

contract CloneConstantFactory {
    event Deployed(address newContract);

    function deployIdentity(address _owner) public {
        address payable deployed = address(new CloneIdentity());
        IdentityPrototype(deployed).constructOwned(_owner);
        emit Deployed(deployed);
    }

    function deployController(address _owner, Identity _identity, address _recovery) public {
        address deployed = address(new CloneController());
        ControllerPrototype(deployed).constructController(_owner, _identity, _recovery);
        emit Deployed(deployed);
    }

    function deployPair(address _owner, address _recovery) public {
        address payable identity = address(new CloneIdentity());
        address controller = address(new CloneController());
        IdentityPrototype(identity).constructOwned(controller);
        ControllerPrototype(controller).constructController(_owner, Identity(identity), _recovery);
        emit Deployed(controller);
    }
}


contract CloneDeployer {
    // 0000000000000000000000000000000000000000 - placeholder of clone's prototype constant.
    // There is 20 bytes to the left. So when the bytecode for the clone contract is loaded into memory the layout is as follows:
    // 32 bytes of lengthOfTheBytecode, then first 20 bytes of bytecode, then 20 bytes of placeholder, then the rest of the bytecode.
    // ...|00000000000000000000000000000000000000000000000000000000000000c0|20 bytes of bytecode|0000000000000000000000000000000000000000|...
    function _deploy(address _prototype) internal returns(address payable result) {
        // Bytecode is pasted here manually from the Clone.sol.
        bytes memory scaffold = hex'602d600081600a8239f35836818037808036817300000000000000000000000000000000000000005af43d91908282803e602b57fd5bf3';
        bytes32 shiftedAddress = bytes32(bytes20(_prototype));
        assembly {
            // Reading 32 bytes of bytecode skipping the 32 bytes length cell and 20 bytes of code before marker.
            let placeholder := mload(add(scaffold, 52))
            // placeholder is 0000000000000000000000000000000000000000************************
            let replace := or(shiftedAddress, placeholder)
            // replace is     prototypeAddressPrototypeAddressPrototyp************************
            mstore(add(scaffold, 52), replace)
            result := create(0, add(scaffold, 32), mload(scaffold))
        }
    }

    function _prepare(address _prototype) internal pure returns(bytes memory) {
        bytes memory scaffold = hex'602d600081600a8239f35836818037808036817300000000000000000000000000000000000000005af43d91908282803e602b57fd5bf3';
        bytes32 shiftedAddress = bytes32(bytes20(_prototype));
        assembly {
            // Reading 32 bytes of bytecode skipping the 32 bytes length cell and 20 bytes of code before marker.
            let placeholder := mload(add(scaffold, 52))
            // placeholder is 0000000000000000000000000000000000000000************************
            let replace := or(shiftedAddress, placeholder)
            // replace is     prototypeAddressPrototypeAddressPrototyp************************
            mstore(add(scaffold, 52), replace)
        }
        return scaffold;
    }

    function _deployCode(bytes memory _code) internal returns(address payable result) {
        assembly {
            result := create(0, add(_code, 32), mload(_code))
        }
    }
}

contract EVMCloneFactory is CloneDeployer {
    event Deployed(address newContract);

    address constant IDENTITY = 0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe;
    address constant CONTROLLER = 0xBEeFbeefbEefbeEFbeEfbEEfBEeFbeEfBeEfBeef;

    function deployPair(address _owner, address _recovery) public {
        address payable identity = _deploy(IDENTITY);
        address controller = _deploy(CONTROLLER);
        IdentityPrototype(identity).constructOwned(controller);
        ControllerPrototype(controller).constructController(_owner, Identity(identity), _recovery);
        emit Deployed(controller);
    }

    function deployPairNoEvent(address _owner, address _recovery) public {
        address payable identity = _deploy(IDENTITY);
        address controller = _deploy(CONTROLLER);
        IdentityPrototype(identity).constructOwned(controller);
        ControllerPrototype(controller).constructController(_owner, Identity(identity), _recovery);
    }

    function deployMulti(address _recovery) public {
        bytes memory identityCode = _prepare(IDENTITY);
        bytes memory controllerCode = _prepare(CONTROLLER);
        for (uint i = 0; i < 40; i++) {
            address payable identity = _deployCode(identityCode);
            address controller = _deployCode(controllerCode);
            IdentityPrototype(identity).constructOwned(controller);
            ControllerPrototype(controller).constructController(msg.sender, Identity(identity), _recovery);
        }
    }
}
