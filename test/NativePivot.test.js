const { accounts, contract } = require('@openzeppelin/test-environment')
const { BN, constants, expectRevert, time, balance } = require('@openzeppelin/test-helpers')
const getInfo = require('./getInfo')
const { expect } = require('chai')
const {ZERO_ADDRESS} = constants

const Pivot = contract.fromArtifact('NativePivot')
const DaiMock = contract.fromArtifact('DaiMock')
const id1 = "0x6c31fc15422ebad28aaf9089c306702f67540b53c7eea8b7d2941044b027100f"
const id2 = "0x859f11b75569a4eb0496c5138fd42cc52aee8cf5c4e7cfafe58c92b2ed138e04"
const min_expire = new BN(1000)
const min_lock = new BN(1000)
const min_price_in = new BN(1000)
const min_price_out = new BN(100000)
const fee = new BN(10)
const zero = new BN(0)

describe('NativePivot', function () {
  const [ guy, otherGuy ] = accounts
  const until = new BN(2000)
  const expire = new BN(4000)
  const price_in = new BN(100000)
  const price_out = new BN(10000000)
  const lock = 10000000000000000 // 0.01 ether
  this.timeout(0)
  
  beforeEach(async function () {
    this.token = await DaiMock.new({ from: guy })
    this.pivot = await Pivot.new(this.token.address, min_expire, min_lock, min_price_in, min_price_out, fee, { from: guy })
    await this.token.approve(this.pivot.address, new BN(2000000000), {from: guy})
    await this.token.transfer(otherGuy, new BN(2000000000), {from: guy})
    await this.token.approve(this.pivot.address, new BN(2000000000), {from: otherGuy})
  })

  it('init', async function () {
    expect(await this.pivot.dai()).to.equal(this.token.address)
    expect(await this.pivot.min_expire()).to.be.bignumber.equal(min_expire)
    expect(await this.pivot.min_lock()).to.be.bignumber.equal(min_lock)
    expect(await this.pivot.min_price_in()).to.be.bignumber.equal(min_price_in)
    expect(await this.pivot.min_price_out()).to.be.bignumber.equal(min_price_out)
    expect(await this.pivot.fee()).to.be.bignumber.equal(fee)
  })

  describe('Initialization Revert', () => {

    it("zero token", async function () {
      await expectRevert(
        Pivot.new(ZERO_ADDRESS, min_expire, min_lock, min_price_in, min_price_out, fee, { from: guy }),
        "Invalid token"
      )
    })

    it("zero min_lock", async function () {
      await expectRevert(
        Pivot.new(this.token.address, min_expire, zero, min_price_in, min_price_out, fee, { from: guy }),
        "Invalid min_lock"
      )
    })

    it("zero min_expire", async function () {
      await expectRevert(
        Pivot.new(this.token.address, zero, min_lock, min_price_in, min_price_out, fee, { from: guy }),
        "Invalid min_expire"
      )
    })

    it("zero min_price_in", async function () {
      await expectRevert(
        Pivot.new(this.token.address, min_expire, min_lock, zero, min_price_out, fee, { from: guy }),
        "Invalid min_price_in"
      )
    })

    it("zero min_price_in", async function () {
      await expectRevert(
        Pivot.new(this.token.address, min_expire, min_lock, min_price_in, zero, fee, { from: guy }),
        "Invalid min_price_out"
      )
    })
  })

  describe('Join', () => {
    it("should join", async function() {
      let timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock})
      timestamp = await time.latest();
      const info = await getInfo(this.pivot, id1)
      expect(info.owner).to.be.equal(guy)
      expect(info.origin).to.be.equal(guy)
      expect(info.expire).to.be.bignumber.equal(timestamp.add(expire))
      expect(info.price_in).to.be.bignumber.equal(price_in)
      expect(info.price_out).to.be.bignumber.equal(price_out)
      expect(info.until).to.be.bignumber.equal(timestamp.add(until))
      expect(info.lock.toString()).to.be.equal(lock.toString())
    })

    it("join should detract lock", async function() {
      const balInitial = await balance.current(guy)
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock})
      expect(await balance.current(guy)).to.be.bignumber.below(balInitial)
    })

    describe('Revert', async function() {
      let timestamp;
      beforeEach(async function () {
        timestamp = await time.latest();
      })

      it("should join only once per id", async function() {
        await this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock})
        await expectRevert(this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock}), 
            "Taken"
        )
      })

      it("shouldnt join with value 0", async function() {
        await expectRevert(
            this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: 0}), 
            "Value is less than min_lock"
        )
      })

      it("shouldnt join with value less than min_lock", async function() {
        await expectRevert(
            this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: 1}), 
            "Value is less than min_lock"
        )
      })

      it("shouldnt join with 0 price_in", async function() {
        await expectRevert(
            this.pivot.join(id1, expire.add(timestamp), zero, price_out, until.add(timestamp), {from: guy, value: lock}), 
            "price_in less than min_price_in"
        )
      })

      it("shouldnt join with price_in less than min_price_in", async function() {
        await expectRevert(
            this.pivot.join(id1, expire.add(timestamp), new BN(1), price_out, until.add(timestamp), {from: guy, value: lock}), 
            "price_in less than min_price_in"
        )
      })

      it("shouldnt join with 0 price_out", async function() {
        await expectRevert(
            this.pivot.join(id1, expire.add(timestamp), price_in, zero, until.add(timestamp), {from: guy, value: lock}), 
            "price_out less than min_price_out"
        )
      })

      it("shouldnt join with price_out less than min_price_out", async function() {
        await expectRevert(
          this.pivot.join(id1, expire.add(timestamp), price_in, new BN(1), until.add(timestamp), {from: guy, value: lock}), 
          "price_out less than min_price_out"
        )
      })

      it("shouldnt join with expire less than timestamp", async function() {
        await expectRevert(this.pivot.join(id1, zero, price_in, price_out, until, {from: guy, value: lock}), 
            "Expire less than now"
        )
      })

      it("shouldnt join with until less than timestamp", async function() {
        await expectRevert(this.pivot.join(id1, expire.add(timestamp), price_in, price_out, zero, {from: guy, value: lock}), 
            "Until less than now"
        )
      })

      it("shouldnt join with expire less than min_expire", async function() {
        await expectRevert(this.pivot.join(id1, timestamp.add(new BN(100)), price_in, price_out, timestamp.add(new BN(50)), {from: guy, value: lock}), 
            "Expire is less than min_expire"
        )
      })

      it("shouldnt join with expire less than until", async function() {
        await expectRevert(this.pivot.join(id1, expire.add(timestamp), price_in, price_out, timestamp.add(new BN(5000)), {from: guy, value: lock}), 
            "Invalid Until"
        )
      })
    })
  })

  describe('Exit', () => {

    beforeEach(async function () {
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock})
    })
    
    it("should Exit", async function() {
      await this.pivot.exit(id1, {from: guy})
      const info = await getInfo(this.pivot, id1)
      expect(info.owner).to.be.equal(ZERO_ADDRESS)
    })

    it("exit should pay back lock", async function() {
      const balInitial = await balance.current(guy)
      await this.pivot.exit(id1, {from: guy})
      expect(await balance.current(guy)).to.be.bignumber.gte(balInitial)
    })

    describe('Revert', async function() {
      it("should exit only once per id", async function() {
        await this.pivot.exit(id1, {from: guy})
        await expectRevert(this.pivot.exit(id1, {from: guy}), 
            "Not alive"
        )
      })

      it("shouldnt exit after buy", async function() {
        await this.pivot.buy(id1, {from: otherGuy})
        await expectRevert(this.pivot.exit(id1, {from: guy}), 
            "Auth"
        )
      })

      it("shouldnt exit after buy and claim", async function() {
        await this.pivot.buy(id1, {from: otherGuy})
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
      await this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock})
    })
    
    it("should Buy", async function() {
      await this.pivot.buy(id1, {from: otherGuy})
      const info = await getInfo(this.pivot, id1)
      expect(info.owner).to.be.equal(otherGuy)
    })

    it("fee system", async function() {
      await this.pivot.buy(id1, {from: otherGuy})
      const info = await getInfo(this.pivot, id1)
      expect(info.owner).to.be.equal(otherGuy)
      const bal = await this.token.balanceOf(guy);
      await this.pivot.take(guy, {from: guy})
      expect(bal).to.be.bignumber.below(await this.token.balanceOf(guy))
    })

    it("buy should pay price_in", async function() {
      const balInitialGuy = await this.token.balanceOf(guy)
      const balInitialOther = await this.token.balanceOf(otherGuy)
      await this.pivot.buy(id1, {from: otherGuy})
      expect(await this.token.balanceOf(guy)).to.be.bignumber.gte(balInitialGuy)
      expect(await this.token.balanceOf(otherGuy)).to.be.bignumber.below(balInitialOther)
    })

    describe('Revert', async function() {
      it("should buy only once per id", async function() {
        await this.pivot.buy(id1, {from: otherGuy})
        await expectRevert(this.pivot.buy(id1, {from: otherGuy}), 
            "Auth"
        )
      })

      it("shouldnt buy after exit", async function() {
        await this.pivot.exit(id1, {from: guy})
        await expectRevert(this.pivot.buy(id1, {from: otherGuy}), 
            "Not alive"
        )
      })

      it("shouldnt exit after claim", async function() {
        await this.pivot.buy(id1, {from: otherGuy})
        await this.pivot.claim(id1, {from: otherGuy})
        await expectRevert(this.pivot.buy(id1, {from: guy}), 
            "Not alive"
        )
      })

      it("origin shouldnt buy", async function() {
        await expectRevert(this.pivot.buy(id1, {from: guy}), 
            "Same"
        )
      })

      it("until shouldnt be expired", async function() {
        await time.increase(until)
        await expectRevert(this.pivot.buy(id1, {from: guy}), 
            "Until exceeded"
        )
      })

      it("sender must be origin", async function() {
        await expectRevert(this.pivot.exit(id1, {from: otherGuy}), 
            "Auth"
        )
      })
    })
  })

  describe('Claim', () => {

    beforeEach(async function () {
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock})
      await this.pivot.buy(id1, {from: otherGuy})
    })
    
    it("should Claim", async function() {
      await this.pivot.claim(id1, {from: otherGuy})
      const info = await getInfo(this.pivot, id1)
      expect(info.alive).to.be.equal(false)
    })

    it("claim should pay price_out", async function() {
      const balInitialGuy = await this.token.balanceOf(guy)
      const balInitialOther = await this.token.balanceOf(otherGuy)
      await this.pivot.claim(id1, {from: otherGuy})
      expect(await this.token.balanceOf(guy)).to.be.bignumber.gte(balInitialGuy)
      expect(await this.token.balanceOf(otherGuy)).to.be.bignumber.below(balInitialOther)
    })

    it("claim should give lock", async function() {
      const balInitial = await balance.current(otherGuy)
      await this.pivot.claim(id1, {from: otherGuy})
      expect(await balance.current(otherGuy)).to.be.bignumber.gte(balInitial)
    })

    describe('Revert', async function() {
      it("should claim only once per id", async function() {
        await this.pivot.claim(id1, {from: otherGuy})
        await expectRevert(this.pivot.claim(id1, {from: otherGuy}), 
            "Not alive"
        )
      })

      it("shouldnt claim when expired", async function() {
        await time.increase(expire)
        await expectRevert(this.pivot.claim(id1, {from: otherGuy}), 
            "Expired"
        )
      })

      it("origin shouldnt claim after ", async function() {
        timestamp = await time.latest();
        await this.pivot.join(id2, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock})
        await expectRevert(this.pivot.claim(id2, {from: guy}), 
            "Same"
        )
      })
    })
  })

  describe('Back - Until', () => {

    beforeEach(async function () {
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock})
      time.increase(until.add(new BN(1)))
    })
    
    it("should back", async function() {
      await this.pivot.back(id1, {from: otherGuy})
      const info = await getInfo(this.pivot, id1)
      expect(info.alive).to.be.equal(false)
    })

    it("back should pay back lock", async function() {
      const balInitial = await balance.current(guy)
      await this.pivot.back(id1, {from: guy})
      expect(await balance.current(guy)).to.be.bignumber.gte(balInitial)
    })

    describe('Revert', async function() {
      it("should back only once per id", async function() {
        await this.pivot.back(id1, {from: guy})
        await expectRevert(this.pivot.back(id1, {from: guy}), 
            "Not alive"
        )
      })
    })
  })

  describe('Back - Expire', () => {

    beforeEach(async function () {
      const timestamp = await time.latest();
      await this.pivot.join(id1, expire.add(timestamp), price_in, price_out, until.add(timestamp), {from: guy, value: lock})
      await this.pivot.buy(id1, {from: otherGuy})
      time.increase(expire.add(new BN(1)))
    })
    
    it("should back", async function() {
      await this.pivot.back(id1, {from: otherGuy})
      const info = await getInfo(this.pivot, id1)
      expect(info.alive).to.be.equal(false)
    })

    it("back should pay back lock", async function() {
      const balInitial = await balance.current(guy)
      await this.pivot.back(id1, {from: guy})
      expect(await balance.current(guy)).to.be.bignumber.gte(balInitial)
    })

    describe('Revert', async function() {
      it("should back only once per id", async function() {
        await this.pivot.back(id1, {from: guy})
        await expectRevert(this.pivot.back(id1, {from: guy}), 
            "Not alive"
        )
      })
    })
  })
})