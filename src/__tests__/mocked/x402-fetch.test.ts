import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Keypair } from "@solana/web3.js";

// ─── Hoisted mock state ────────────────────────────────────────

const mockGetAccountInfo = vi.hoisted(() => vi.fn());
const mockGetLatestBlockhash = vi.hoisted(() => vi.fn());

// ─── Module mocks ──────────────────────────────────────────────

vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getAccountInfo: mockGetAccountInfo,
      getLatestBlockhash: mockGetLatestBlockhash,
    })),
    Transaction: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockReturnThis(),
      sign: vi.fn(),
      serialize: vi.fn().mockReturnValue(Buffer.from("fakeTx")),
    })),
  };
});

// ─── Helpers ───────────────────────────────────────────────────

// Use valid devnet addresses for test fixtures
const DEVNET_USDC_MINT = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

function makeCoinbase402Body() {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "solana-devnet",
        maxAmountRequired: "100000",
        payTo: SYSTEM_PROGRAM,
        asset: DEVNET_USDC_MINT,
      },
    ],
  };
}

function makeFaremeter402Body() {
  return {
    payment: {
      recipientWallet: SYSTEM_PROGRAM,
      tokenAccount: "So11111111111111111111111111111111111111112",
      mint: DEVNET_USDC_MINT,
      amount: "100000",
      cluster: "devnet",
    },
  };
}

function makeOkResponse(data: unknown = { result: "ok" }) {
  return {
    status: 200,
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: { get: () => null },
  };
}

function make402Response(body: unknown, paymentRequiredHeader: string | null = null) {
  return {
    status: 402,
    ok: false,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: {
      get: (name: string) => {
        const lower = name.toLowerCase();
        if (lower === "payment-required") return paymentRequiredHeader;
        return null;
      },
    },
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  mockGetAccountInfo.mockResolvedValue({ data: Buffer.alloc(0) });
  mockGetLatestBlockhash.mockResolvedValue({ blockhash: "mockBlockhash" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── x402Fetch tests ──────────────────────────────────────────

describe("x402Fetch – non-402 response", () => {
  it("returns response as-is without attempting payment", async () => {
    const { x402Fetch } = await import("../../solana/x402.js");
    const keypair = Keypair.generate();

    const mockFetch = vi.fn().mockResolvedValue(makeOkResponse({ data: "hello" }));
    vi.stubGlobal("fetch", mockFetch);

    const result = await x402Fetch("https://example.com/api", keypair, { network: "devnet" });

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("x402Fetch – 402 with unparseable body", () => {
  it("returns success:false with error message", async () => {
    const { x402Fetch } = await import("../../solana/x402.js");
    const keypair = Keypair.generate();

    const mockFetch = vi.fn().mockResolvedValue(make402Response({ not: "x402" }));
    vi.stubGlobal("fetch", mockFetch);

    const result = await x402Fetch("https://example.com/api", keypair, { network: "devnet" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Could not parse payment requirements");
    expect(result.status).toBe(402);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("x402Fetch – 402 with Coinbase format body", () => {
  it("retries with X-PAYMENT header containing valid base64 JSON", async () => {
    const { x402Fetch } = await import("../../solana/x402.js");
    const keypair = Keypair.generate();

    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(make402Response(makeCoinbase402Body()));
    mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true }));
    vi.stubGlobal("fetch", mockFetch);

    const result = await x402Fetch("https://example.com/api", keypair, { network: "devnet" });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify second call has X-PAYMENT header
    const [_url, options] = mockFetch.mock.calls[1];
    expect(options.headers["X-PAYMENT"]).toBeDefined();

    // Decode and verify X-PAYMENT header structure
    const paymentHeader = JSON.parse(
      Buffer.from(options.headers["X-PAYMENT"], "base64").toString("utf-8"),
    );
    expect(paymentHeader.x402Version).toBe(1);
    expect(paymentHeader.scheme).toBe("exact");
    expect(paymentHeader.network).toBe("solana-devnet");
    expect(paymentHeader.payload.serializedTransaction).toBeDefined();
    expect(typeof paymentHeader.payload.serializedTransaction).toBe("string");
  });
});

describe("x402Fetch – 402 with Faremeter format body", () => {
  it("retries with X-PAYMENT header (same retry flow as Coinbase)", async () => {
    const { x402Fetch } = await import("../../solana/x402.js");
    const keypair = Keypair.generate();

    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(make402Response(makeFaremeter402Body()));
    mockFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }));
    vi.stubGlobal("fetch", mockFetch);

    const result = await x402Fetch("https://example.com/api", keypair, { network: "devnet" });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [_url, options] = mockFetch.mock.calls[1];
    const paymentHeader = JSON.parse(
      Buffer.from(options.headers["X-PAYMENT"], "base64").toString("utf-8"),
    );
    expect(paymentHeader.network).toBe("solana-devnet");
  });
});

describe("x402Fetch – PAYMENT-REQUIRED header (v2)", () => {
  it("parses header over body for payment requirements", async () => {
    const { x402Fetch } = await import("../../solana/x402.js");
    const keypair = Keypair.generate();

    const headerData = {
      accepts: [
        {
          scheme: "exact",
          network: "solana",
          maxAmountRequired: "200000",
          payTo: SYSTEM_PROGRAM,
          asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        },
      ],
    };
    const paymentRequiredHeader = Buffer.from(JSON.stringify(headerData)).toString("base64");

    const mockFetch = vi.fn();
    // 402 with header (different from body)
    mockFetch.mockResolvedValueOnce(
      make402Response(makeCoinbase402Body(), paymentRequiredHeader),
    );
    mockFetch.mockResolvedValueOnce(makeOkResponse());
    vi.stubGlobal("fetch", mockFetch);

    const result = await x402Fetch("https://example.com/api", keypair, { network: "mainnet-beta" });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [_url, options] = mockFetch.mock.calls[1];
    const paymentHeader = JSON.parse(
      Buffer.from(options.headers["X-PAYMENT"], "base64").toString("utf-8"),
    );
    // Should use header's network, not body's
    expect(paymentHeader.network).toBe("solana");
  });
});

describe("x402Fetch – X-PAYMENT-RESPONSE header", () => {
  it("extracts txSignature from response header", async () => {
    const { x402Fetch } = await import("../../solana/x402.js");
    const keypair = Keypair.generate();

    const paymentResponseData = { txHash: "FakeTxSignature123abc" };
    const paymentResponseHeader = Buffer.from(
      JSON.stringify(paymentResponseData),
    ).toString("base64");

    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce(make402Response(makeCoinbase402Body()));
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      text: () => Promise.resolve("ok"),
      headers: {
        get: (name: string) => {
          if (name === "X-PAYMENT-RESPONSE") return paymentResponseHeader;
          return null;
        },
      },
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await x402Fetch("https://example.com/api", keypair, { network: "devnet" });

    expect(result.success).toBe(true);
    expect(result.txSignature).toBe("FakeTxSignature123abc");
  });
});

// ─── probeX402 tests ──────────────────────────────────────────

describe("probeX402", () => {
  it("returns null for non-402 response", async () => {
    const { probeX402 } = await import("../../solana/x402.js");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkResponse({ free: true })));

    const result = await probeX402("https://example.com/free");
    expect(result).toBeNull();
  });

  it("returns null for 402 with no Solana requirements", async () => {
    const { probeX402 } = await import("../../solana/x402.js");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(make402Response({ foo: "bar" })));

    const result = await probeX402("https://example.com/gated");
    expect(result).toBeNull();
  });

  it("returns parsed requirements for 402 with Solana reqs", async () => {
    const { probeX402 } = await import("../../solana/x402.js");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(make402Response(makeCoinbase402Body())));

    const result = await probeX402("https://example.com/paid");
    expect(result).not.toBeNull();
    expect(result?.scheme).toBe("exact");
    expect(result?.network).toBe("solana-devnet");
    expect(result?.maxAmountRequired).toBe("100000");
  });

  it("returns null when fetch throws", async () => {
    const { probeX402 } = await import("../../solana/x402.js");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await probeX402("https://example.com/down");
    expect(result).toBeNull();
  });
});
