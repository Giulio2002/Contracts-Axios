const { accounts, contract } = require('@openzeppelin/test-environment')
const { BN, constants, expectRevert, time, balance } = require('@openzeppelin/test-helpers')
const {getInfo2} = require('./getInfo')
const { expect } = require('chai')
const {ZERO_ADDRESS} = constants

const getInfo = getInfo2
const Pivot = contract.fromArtifact('TokenPivot2')
const TokenMock = contract.fromArtifact('TokenMock')
const id1 = "0x6c31fc15422ebad28aaf9089c306702f67540b53c7eea8b7d2941044b027100f"
const id2 = "0x859f11b75569a4eb0496c5138fd42cc52aee8cf5c4e7cfafe58c92b2ed138e04"
const min_expire = new BN(1000)
const min_lock = new BN(1000)
const min_ask = new BN(1)
const min_strike = new BN(1)
const fee = new BN(10)
const zero = new BN(0)

describe('NativePivot V. 2.0', function () {
  const [ guy, otherGuy ] = accounts
  const expire = new BN(4000)
  const ask = new BN(10) // 10 Token Per ETH
  const strike = new BN(20) // 20 Token Per ETH
  const lock = new BN("10000000000000000") // 0.01 ether
  this.timeout(0)
  
  beforeEach(async function () {
    this.dai = await TokenMock.new({ from: guy })
    this.token = await TokenMock.new({ from: guy })
    this.pivot = await Pivot.new(this.dai.address, this.token.address, min_expire, min_lock, min_ask, min_strike, fee, { from: guy })
    await this.token.approve(this.pivot.address, new BN("1000000000000000000000"), {from: guy})
    await this.token.transfer(otherGuy, new BN("1000000000000000000000"), {from: guy})
    await this.token.approve(this.pivot.address, new BN("1000000000000000000000"), {from: otherGuy})
    await this.dai.approve(this.pivot.address, new BN("1000000000000000000000"), {from: guy})
    await this.dai.transfer(otherGuy, new BN("1000000000000000000000"), {from: guy})
    await this.dai.approve(this.pivot.address, new BN("1000000000000000000000"), {from: otherGuy})
   })

  it('init', async function () {
    expect(await this.pivot.dai()).to.equal(this.dai.address)
    expect(await this.pivot.tkn()).to.equal(this.token.address)
    expect(await this.pivot.min_expire()).to.be.bignumber.equal(min_expire)
    expect(await this.pivot.min_lock()).to.be.bignumber.equal(min_lock)
    expect(await this.pivot.min_ask()).to.be.bignumber.equal(min_ask)
    expect(await this.pivot.min_strike()).to.be.bignumber.equal(min_strike)
    expect(await this.pivot.fee()).to.be.bignumber.equal(fee)
  })

  describe('Initialization Revert', () => {

    it("zero token", async function () {
      await expectRevert(
        Pivot.new(ZERO_ADDRESS, this.token.address, min_expire, min_lock, min_ask, min_strike, fee, { from: guy }),
        "Invalid token"
      )
    })

    it("zero min_lock", async function () {
      await expectRevert(
        Pivot.new(this.dai.address, this.token.address, min_expire, zero, min_ask, min_strike, fee, { from: guy }),
        "Invalid min_lock"
      )
    })

    it("zero min_expire", async function () {
      await expectRevert(
        Pivot.new(this.dai.address, this.token.address, zero, min_lock, min_ask, min_strike, fee, { from: guy }),
        "Invalid min_expire"
      )
    })

    it("zero min_ask", async function () {
      await expectRevert(
        Pivot.new(this.dai.address, this.token.address, min_expire, min_lock, zero, min_strike, fee, { from: guy }),
        "Invalid min_ask"
      )
    })

    it("zero min_ask", async function () {
      await expectRevert(
        Pivot.new(this.dai.address, this.token.address, min_expire, min_lock, min_ask, zero, fee, { from: guy }),
        "Invalid min_strike"
      )
    })
  })

  describe('Join', () => {
    it("should join", async function() {
      let timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), ask, strike, lock, {from: guy})
      const info = await getInfo(this.pivot, id1)
      expect(info.origin).to.be.equal(guy)
      expect(info.expire).to.be.bignumber.equal(expire.add(timestamp))
      expect(info.ask).to.be.bignumber.equal(ask)
      expect(info.strike).to.be.bignumber.equal(strike)
      expect(info.lock.toString()).to.be.equal(lock.toString())
    })

    it("join should detract lock", async function() {
      const balInitial = await balance.current(guy)
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), ask, strike, lock, {from: guy})
      expect(await balance.current(guy)).to.be.bignumber.below(balInitial)
    })

    describe('Revert', async function() {
      let timestamp;
      beforeEach(async function () {
        timestamp = await time.latest();
      })

      it("should join only once per id", async function() {
        await this.pivot.join(id1, expire.add(timestamp), ask, strike, lock, {from: guy})
        await expectRevert(this.pivot.join(id1, expire.add(timestamp), ask, strike, lock, {from: guy}), 
            "Taken"
        )
      })

      it("shouldnt join with value 0", async function() {
        await expectRevert(
            this.pivot.join(id1, expire.add(timestamp), ask, strike, zero, {from: guy}), 
            "Value is less than min_lock"
        )
      })

      it("shouldnt join with value less than min_lock", async function() {
        await expectRevert(
            this.pivot.join(id1, expire.add(timestamp), ask, strike, new BN(1), {from: guy}), 
            "Value is less than min_lock"
        )
      })

      it("shouldnt join with 0 ask", async function() {
        await expectRevert(
            this.pivot.join(id1, expire.add(timestamp), zero, strike, lock, {from: guy}), 
            "Ask less than min_ask"
        )
      })

      it("shouldnt join with 0 strike", async function() {
        await expectRevert(
            this.pivot.join(id1, expire.add(timestamp), ask, zero, lock, {from: guy}), 
            "Strike less than min_strike"
        )
      })

      it("shouldnt join with expire less than timestamp", async function() {
        await expectRevert(this.pivot.join(id1, zero, ask, strike, lock, {from: guy}), 
            "Expire less than now"
        )
      })
    })
  })

  describe('Exit', () => {

    beforeEach(async function () {
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), ask, strike, lock, {from: guy})
    })

    it("exit should pay back lock", async function() {
      const balInitial = await this.token.balanceOf(guy)
      await this.pivot.exit(id1, {from: guy})
      expect(await this.token.balanceOf(guy)).to.be.bignumber.gte(balInitial)
    })

    describe('Revert', async function() {
      it("should exit only once per id", async function() {
        await this.pivot.exit(id1, {from: guy})
        await expectRevert(this.pivot.exit(id1, {from: guy}), 
            "Not alive"
        )
      })

      it("shouldnt exit after buy", async function() {
        await this.pivot.buy(id1, new BN(lock.toString()), {from: otherGuy})
        await expectRevert(this.pivot.exit(id1, {from: guy}), 
            "Not alive"
        )
      })

      it("shouldnt exit after buy and claim", async function() {
        await this.pivot.buy(id1, new BN(lock.toString()), {from: otherGuy})
        await this.pivot.claim(id1, {from: otherGuy})
        await expectRevert(this.pivot.exit(id1, {from: guy}), 
            "Not alive"
        )
      })

      it("sender must be origin", async function() {
        await expectRevert(this.pivot.exit(id1, {from: otherGuy}), 
            "Auth"
        )
      })
    })
  })

  describe('Buy', () => {

    beforeEach(async function () {
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), ask, strike, lock, {from: guy})
    })

    it("buy should pay ask", async function() {
      const balInitialGuy = await this.dai.balanceOf(guy)
      const balInitialOther = await this.dai.balanceOf(otherGuy)
      await this.pivot.buy(id1, new BN(lock.toString()), {from: otherGuy})
      expect(await this.dai.balanceOf(guy)).to.be.bignumber.gte(balInitialGuy)
      expect(await this.dai.balanceOf(otherGuy)).to.be.bignumber.below(balInitialOther)
    })

    describe('Revert', async function() {
      it("should buy only once per id", async function() {
        await this.pivot.buy(id1, new BN(lock.toString()), {from: otherGuy})
        await expectRevert(this.pivot.buy(id1, new BN(lock.toString()),{from: otherGuy}), 
            "Auth"
        )
      })

      it("shouldnt buy after exit", async function() {
        await this.pivot.exit(id1, {from: guy})
        await expectRevert(this.pivot.buy(id1, new BN(lock.toString()), {from: otherGuy}), 
            "Auth"
        )
      })

      it("shouldnt exit after claim", async function() {
        await this.pivot.buy(id1, new BN(lock.toString()), {from: otherGuy})
        await this.pivot.claim(id1, {from: otherGuy})
        await expectRevert(this.pivot.buy(id1, new BN(lock.toString()), {from: guy}), 
            "Auth"
        )
      })

      it("origin shouldnt buy", async function() {
        await expectRevert(this.pivot.buy(id1, new BN(lock.toString()), {from: guy}), 
            "Same"
        )
      })

      it("shouldnt overbuy", async function() {
        await expectRevert(this.pivot.buy(id1, new BN((lock+100).toString()), {from: otherGuy}), 
            "Auth"
        )
      })
    })
  })

  describe('Claim', () => {

    beforeEach(async function () {
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), ask, strike, lock, {from: guy})
      await this.pivot.buy(id1, new BN(lock.toString()), {from: otherGuy})
    })
    
    it("should Claim", async function() {
      await this.pivot.claim(id1, {from: otherGuy})
    })

    it("claim should pay strike", async function() {
      const balInitialGuy = await this.dai.balanceOf(guy)
      const balInitialOther = await this.dai.balanceOf(otherGuy)
      await this.pivot.claim(id1, {from: otherGuy})
      expect(await this.dai.balanceOf(guy)).to.be.bignumber.gte(balInitialGuy)
      expect(await this.dai.balanceOf(otherGuy)).to.be.bignumber.below(balInitialOther)
    })

    it("claim should give lock", async function() {
      const balInitial = await this.token.balanceOf(otherGuy)
      await this.pivot.claim(id1, {from: otherGuy})
      expect(await this.token.balanceOf(otherGuy)).to.be.bignumber.gte(balInitial)
    })

    describe('Revert', async function() {
      it("should claim only once per id", async function() {
        await this.pivot.claim(id1, {from: otherGuy})
        await expectRevert(this.pivot.claim(id1, {from: otherGuy}), 
            "No shares"
        )
      })

      it("shouldnt claim when expired", async function() {
        await time.increase(expire)
        await expectRevert(this.pivot.claim(id1, {from: otherGuy}), 
            "Expired"
        )
      })

      it("origin shouldnt claim", async function() {
        timestamp = await time.latest();
        await this.pivot.join(id2, expire.add(timestamp), ask, strike, lock, {from: guy})
        await expectRevert(this.pivot.claim(id2, {from: guy}), 
            "Auth"
        )
      })
    })
  })

  describe('Back', () => {

    beforeEach(async function () {
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), ask, strike, lock, {from: guy})
      await this.pivot.buy(id1, lock.toString(),{from: otherGuy})
      time.increase(expire.add(new BN(1)))
    })

    it("back should pay back lock", async function() {
      const balInitial = await this.token.balanceOf(guy)
      await this.pivot.back(id1, {from: guy})
      expect(await this.token.balanceOf(guy)).to.be.bignumber.gte(balInitial)
    })

    describe('Revert', async function() {
      it("should back only once per id", async function() {
        await this.pivot.back(id1, {from: guy})
        await expectRevert(this.pivot.back(id1, {from: guy}), 
            "Not alive"
        )
      })
      it("shouldnt back if not expired", async function() {
        await this.pivot.join(id2, (await time.latest()).add(new BN(40000)), ask, strike, lock, {from: guy})
        await expectRevert(this.pivot.back(id2, {from: guy}), 
            "Not Expired"
        )
      })
    })
  })
})