import { expect, test } from 'vitest';
import { createLatestGate } from '../src/latestGate';

test('overlapping work only publishes the latest result', async () => {
  const gate = createLatestGate();
  const published: string[] = [];
  let finishOld!: (value: string) => void;
  const oldWork = new Promise<string>((resolve) => { finishOld = resolve; });

  const oldRun = gate.run(() => oldWork, (value) => published.push(value));
  const newRun = gate.run(async () => 'new', (value) => published.push(value));

  await newRun;
  finishOld('old');
  await oldRun;

  expect(published).toEqual(['new']);
});
