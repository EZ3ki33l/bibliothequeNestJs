export function betterAuth() {
  return {
    api: {
      getSession: () => Promise.resolve(null),
    },
  };
}
