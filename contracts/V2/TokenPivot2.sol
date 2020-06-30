pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Eventful.sol";
import "./Math.sol";

// V3
contract TokenPivot2 is Ownable, Eventful {
    using SafeMath for uint256;

    ERC20 public dai;
    ERC20 public tkn;
    uint256 public min_lock;
    uint256 public min_expire;
    uint256 public min_ask;
    uint256 public min_strike;
    uint256 public fee;

    struct Option {
        address payable origin;
        uint256 lock;
        uint256 expire;
        uint256 strike;
        uint256 ask;
    }

    mapping(bytes32 => Option) opts;
    mapping(bytes32 => uint256) public composite;
    mapping(address => mapping(bytes32 => uint256)) private shares;

    constructor(address _dai, address _tkn, uint256 _min_expire, uint256 _min_lock, uint256 _min_ask, uint256 _min_strike, uint256 _fee) public {
        require(_dai != address(0), "Invalid token");
        require(_tkn != address(0), "Invalid token");
        require(_min_lock != 0, "Invalid min_lock");
        require(_min_expire != 0, "Invalid min_expire");
        require(_min_ask != 0, "Invalid min_ask");
        require(_min_strike != 0, "Invalid min_strike");
        dai = ERC20(_dai);
        tkn = ERC20(_tkn);
        min_lock = _min_lock;
        min_expire = _min_expire;
        min_ask = _min_ask;
        min_strike = _min_strike;
        fee = _fee;
    }

    function join(bytes32 id, uint256 expire, uint256 ask, uint256 strike, uint256 amount) public returns(bool) {
        require(opts[id].lock == 0, "Taken");
        require(amount >= min_lock, "Value is less than min_lock");
        require(ask >= min_ask, "Ask less than min_ask");
        require(expire > now, "Expire less than now");
        require(strike >= min_strike, "Strike less than min_strike");
        require(expire.sub(now) >= min_expire, "Expire is less than min_expire");
        opts[id] = Option(msg.sender, amount, expire, strike, ask);
        composite[id] = amount;
        tkn.transferFrom(msg.sender, address(this), amount);
        emit Updated(id, 'join', msg.sender);

        return true;
    }

    function exit(bytes32 id) public returns(bool) {
        uint256 share = opts[id].lock;
        require(opts[id].origin == msg.sender, "Auth");
        require(opts[id].expire > now, "Expired");
        require(share != 0, "Not alive");
        composite[id] = composite[id].sub(opts[id].lock);
        opts[id].lock = 0;
        tkn.transfer(msg.sender, share);

        emit Updated(id, 'exit', msg.sender);
        return true;
    }

    function buy(bytes32 id, uint256 amount) public returns(bool) {
        require(opts[id].lock >= amount, "Auth");
        require(opts[id].origin != msg.sender, "Same");
        require(opts[id].expire > now, "Expired");
        
        shares[msg.sender][id] = shares[msg.sender][id].add(amount);
        opts[id].lock = opts[id].lock.sub(amount);

        emit Updated(id, 'buy', msg.sender);
        dai.transferFrom(msg.sender, address(this), fee);
        return dai.transferFrom(msg.sender, opts[id].origin, opts[id].ask.mul(opts[id].lock));
    }

    function claim(bytes32 id) public returns(bool) {
        uint256 share = shares[msg.sender][id];
        require(opts[id].expire > now, "Expired");
        require(opts[id].origin != msg.sender, "Auth");
        require(share != 0, "No shares");

        shares[msg.sender][id] = 0;
        dai.transferFrom(msg.sender, opts[id].origin, opts[id].strike.mul(share));
        composite[id] = composite[id].sub(share);

        tkn.transfer(msg.sender, share);
        emit Updated(id, 'claim', msg.sender);

        return true;
    }

    function back(bytes32 id) public returns(bool) {
        require(composite[id] != 0, "Not alive");
        require(opts[id].expire <= now, "Not Expired");

        tkn.transfer(opts[id].origin, composite[id]);
        composite[id] = 0;

        emit Updated(id, 'back', msg.sender);

        return true;
    }

    function take(address guy) onlyOwner public returns(bool) {
        return dai.transfer(guy, dai.balanceOf(address(this)));
    }

    function setParam(bytes32 param, uint256 value) public onlyOwner returns(bool) {
        require(value != 0, "zero");
        if (param == 'min_lock') {
            min_lock = value;
        } else if (param == 'min_expire') {
            min_expire = value;
        } else if (param == 'min_ask') {
            min_ask = value;
        } else if (param == 'min_strike') {
            min_strike = value;
        } else {
            revert('Invalid Param');
        }
        emit ParamChange(param, value);
        return true;
    }

    function getExpire(bytes32 id) public view returns(uint256) {
        return opts[id].expire;
    }

    function getOrigin(bytes32 id) public view returns(address) {
        return opts[id].origin;
    }

    function getLock(bytes32 id) public view returns(uint256) {
        return opts[id].lock;
    }

    function getAsk(bytes32 id) public view returns(uint256) {
        return opts[id].ask;
    }

    function getStrike(bytes32 id) public view returns(uint256) {
        return opts[id].strike;
    }

    function getShares(address guy, bytes32 id) public view returns(uint256) {
        if (opts[id].expire < now) return 0;
        else                       return shares[guy][id];
    }
}