export type NetworkRequest = {
  id: string;
  method: string;
  url: string;
  body: unknown;
};

export type NetworkResponse = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

export type NetworkFixture = {
  readonly requests: readonly NetworkRequest[];
  readonly online: boolean;
  setOnline(value: boolean): void;
  route(
    matcher: string | RegExp,
    handler: (
      request: NetworkRequest,
    ) => NetworkResponse | Promise<NetworkResponse>,
  ): void;
  fetch(
    input: string | URL,
    init?: { method?: string; body?: unknown },
  ): Promise<NetworkResponse>;
};

export function createNetworkFixture(): NetworkFixture {
  const requests: NetworkRequest[] = [];
  const routes: Array<{
    matcher: string | RegExp;
    handler: (
      request: NetworkRequest,
    ) => NetworkResponse | Promise<NetworkResponse>;
  }> = [];
  let online = true;
  let nextRequest = 0;

  return {
    get requests() {
      return requests;
    },
    get online() {
      return online;
    },
    setOnline: (value) => {
      online = value;
    },
    route: (matcher, handler) => {
      routes.push({ matcher, handler });
    },
    fetch: async (input, init = {}) => {
      if (!online) throw new TypeError("Deterministic network is offline.");
      const request: NetworkRequest = {
        id: `request-${String(++nextRequest).padStart(4, "0")}`,
        method: (init.method ?? "GET").toUpperCase(),
        url: String(input),
        body: init.body ?? null,
      };
      requests.push(request);
      const match = routes.find(({ matcher }) =>
        typeof matcher === "string"
          ? matcher === request.url
          : matcher.test(request.url)
      );
      if (!match) {
        return { status: 404, body: { error: "No deterministic route" } };
      }
      return await match.handler(request);
    },
  };
}
