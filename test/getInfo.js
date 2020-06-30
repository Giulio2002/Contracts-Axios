const getInfo = async (pivot, id) => {
    const expire = await pivot.getExpire(id);
    const origin = await pivot.getOrigin(id);
    const lock = await pivot.getLock(id);
    const owner = await pivot.getOwner(id);
    const until = await pivot.getUntil(id);
    const price_in = await pivot.getPriceIn(id);
    const price_out = await pivot.getPriceOut(id);
    return {expire, origin, lock, price_in, price_out, owner, until}
}

const getInfo2 = async (pivot, id) => {
    const expire = await pivot.getExpire(id);
    const origin = await pivot.getOrigin(id);
    const lock = await pivot.getLock(id);
    // const until = await pivot.getUntil(id);
    const ask = await pivot.getAsk(id);
    const strike = await pivot.getStrike(id);
    return {expire, origin, lock, ask, strike}
}

module.exports = {getInfo, getInfo2};