export function createLatestGate() {
  let gen = 0;
  return {
    async run<T>(work: () => Promise<T>, publish: (value: T) => void): Promise<void> {
      const id = ++gen;
      const value = await work();
      if (id === gen) publish(value);
    },
  };
}
