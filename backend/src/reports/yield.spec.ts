import { aggregateYield, type YieldRun } from './yield';

const run = (o: Partial<YieldRun>): YieldRun => ({ loadId: 'L1', woodType: 'Teak', input: 10, output: 6, loadCft: 20, ...o });

describe('aggregateYield', () => {
  it('recovery is total out ÷ total in, so a big run weighs more than a small one', () => {
    const [g] = aggregateYield([run({ input: 100, output: 70 }), run({ loadId: 'L2', input: 10, output: 3 })], (r) => r.woodType);
    expect(g).toMatchObject({ loads: 2, runs: 2, input: 110, output: 73, waste: 37, recovery: 66.4 });
  });

  it('cost per finished CFT = cost of the raw wood used ÷ what it gave', () => {
    // load: 20 CFT bought for ₹20,000 → ₹1,000 / CFT; 10 CFT used → ₹10,000; gave 6 CFT → ₹1,666.67 per finished CFT
    const [g] = aggregateYield([run({ purchaseAmount: 20_000 })], (r) => r.woodType);
    expect(g).toMatchObject({ avgRate: 1000, costPerFinished: 1666.67, cost: 10_000 });
  });

  it('a cheaper supplier with poor recovery can cost more per usable CFT', () => {
    const groups = aggregateYield(
      [
        run({ supplierId: 'A', supplierName: 'Cheap', purchaseAmount: 16_000, output: 4 }), // ₹800/CFT, 40% → ₹2,000
        run({ supplierId: 'B', supplierName: 'Good', loadId: 'L2', purchaseAmount: 20_000, output: 7 }), // ₹1,000/CFT, 70% → ₹1,428.57
      ],
      (r) => `${r.supplierId}|${r.woodType}`,
    );
    const by = Object.fromEntries(groups.map((g) => [g.supplierName, g]));
    expect(by.Cheap.costPerFinished).toBe(2000);
    expect(by.Good.costPerFinished).toBe(1428.57);
  });

  it('runs without a purchase price are left out of cost, not counted as free; runs without input are skipped', () => {
    const [g] = aggregateYield([run({ purchaseAmount: 20_000 }), run({ loadId: 'L2', purchaseAmount: null }), run({ loadId: 'L3', input: 0 })], (r) => r.woodType);
    expect(g).toMatchObject({ runs: 2, input: 20, avgRate: 1000, costPerFinished: 1666.67 });
  });
});
