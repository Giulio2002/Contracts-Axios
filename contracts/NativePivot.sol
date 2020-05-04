pragma solidity >=0.4.21 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Eventful.sol";

contract NativePivot is Ownable, Eventful {
    using SafeMath for uint256;

    ERC20 public dai;
    uint256 public min_lock;
    uint256 public min_expire;
    uint256 public min_price_in;
    uint256 public min_price_out;
    uint256 public fee;

    struct Option {
        address payable origin;
        address owner;
        uint256 lock;
        uint256 expire;
        uint256 until;
        uint256 price_in;
        uint256 price_out;
    }

    mapping(bytes32 => Option) opts;

    constructor(address _dai, uint256 _min_expire, uint256 _min_lock, uint256 _min_price_in, uint256 _min_price_out, uint256 _fee) public {
        require(_dai != address(0), "Invalid token");
        require(_min_lock != 0, "Invalid min_lock");
        require(_min_expire != 0, "Invalid min_expire");
        require(_min_price_in != 0, "Invalid min_price_in");
        require(_min_price_out != 0, "Invalid min_price_out");
        dai = ERC20(_dai);
        min_lock = _min_lock;
        min_expire = _min_expire;
        min_price_in = _min_price_in;
        min_price_out = _min_price_out;
        fee = _fee;
    }

    function join(bytes32 id, uint256 expire, uint256 price_in, uint256 price_out, uint256 until) public payable returns(bool) {
        require(opts[id].origin == address(0), "Taken");
        require(msg.value >= min_lock, "Value is less than min_lock");
        require(price_in >= min_price_in, "price_in less than min_price_in");
        require(expire > now, "Expire less than now");
        require(until > now, "Until less than now");
        require(price_out >= min_price_out, "price_out less than min_price_out");
        require(expire.sub(now) >= min_expire, "Expire is less than min_expire");
        require(until <= expire,"Invalid Until");
        opts[id].origin = msg.sender;
        opts[id].owner = msg.sender;
        opts[id].lock = msg.value;
        opts[id].until = until;
        opts[id].expire = expire;
        opts[id].price_in = price_in;
        opts[id].price_out = price_out;

        emit Updated(id);
        return true;
    }

    function exit(bytes32 id) public returns(bool) {
        require(opts[id].origin == opts[id].owner, "Auth");
        require(opts[id].origin == msg.sender, "Auth");
        uint256 value = opts[id].lock;
        opts[id].owner = address(0);
        opts[id].origin.transfer(value);

        emit Updated(id);
        return true;
    }

    function buy(bytes32 id) public returns(bool) {
        require(opts[id].until > now, "Until exceeded");
        require(opts[id].origin == opts[id].owner, "Auth");
        require(opts[id].origin != msg.sender, "Same");
        opts[id].owner = msg.sender;
        emit Updated(id);
        dai.transferFrom(msg.sender, address(this), fee);
        return dai.transferFrom(msg.sender, opts[id].origin, opts[id].price_in);
    }

    function claim(bytes32 id) public returns(bool) {
        require(opts[id].expire > now, "Expired");
        require(opts[id].origin != opts[id].owner, "Same");
        require(msg.sender == opts[id].owner, "Auth");

        opts[id].owner = address(0);
        dai.transferFrom(msg.sender, opts[id].origin, opts[id].price_out);
        msg.sender.transfer(opts[id].lock);
        emit Updated(id);

        return true;
    }

    function back(bytes32 id) public returns(bool) {
        require(opts[id].owner != address(0), "Invalid id");
        require(now > opts[id].expire || (now > opts[id].until && opts[id].owner == opts[id].origin), "Too soon");

        opts[id].owner = address(0);
        opts[id].origin.transfer(opts[id].lock);
        emit Updated(id);

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
        } else if (param == 'min_price_in') {
            min_price_in = value;
        } else if (param == 'min_price_out') {
            min_price_out = value;
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

    function getOwner(bytes32 id) public view returns(address) {
        return opts[id].owner;
    }

    function getLock(bytes32 id) public view returns(uint256) {
        return opts[id].lock;
    }

    function getPriceIn(bytes32 id) public view returns(uint256) {
        return opts[id].price_in;
    }

    function getPriceOut(bytes32 id) public view returns(uint256) {
        return opts[id].price_out;
    }

    function getUntil(bytes32 id) public view returns(uint256) {
        return opts[id].until;
    }
}