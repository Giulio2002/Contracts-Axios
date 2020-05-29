const getInfo = async (pivot, id) => {
    const expire = await pivot.getExpire(id);
    const origin = await pivot.getOrigin(id);
    const owner = await pivot.getOwner(id);
    const lock = await pivot.getLock(id);
    const until = await pivot.getUntil(id);
    const price_in = await pivot.getPriceIn(id);
    const price_out = await pivot.getPriceOut(id);
    const alive = (await pivot.getStatus(id)) === 1; 
    return {expire, origin, owner, lock, until, price_in, price_out, alive}
}

module.exports = getInfo;