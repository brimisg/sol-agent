import { describe, it, expect } from "vitest";
import { parsePaymentRequirements, toX402Network } from "../../solana/x402.js";

describe("toX402Network", () => {
  it('"mainnet-beta" → "solana"', () => {
    expect(toX402Network("mainnet-beta")).toBe("solana");
  });

  it('"devnet" → "solana-devnet"', () => {
    expect(toX402Network("devnet")).toBe("solana-devnet");
  });

  it('"testnet" → "solana-testnet"', () => {
    expect(toX402Network("testnet")).toBe("solana-testnet");
  });

  it("unknown network → prefixed with solana-", () => {
    expect(toX402Network("localnet")).toBe("solana-localnet");
  });

  it("already x402 format passthrough", () => {
    expect(toX402Network("solana-devnet")).toBe("solana-devnet");
    expect(toX402Network("solana")).toBe("solana");
  });
});

const FAKE_MINT = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const FAKE_PAYTO = "11111111111111111111111111111111";
const FAKE_TOKEN_ACCOUNT = "So11111111111111111111111111111111111111112";

describe("parsePaymentRequirements – Coinbase x402 format", () => {
  const coinbaseBody = {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "solana-devnet",
        maxAmountRequired: "100000",
        payTo: FAKE_PAYTO,
        asset: FAKE_MINT,
      },
    ],
  };

  it("parses scheme, network, amount, payTo, asset", () => {
    const result = parsePaymentRequirements(coinbaseBody);
    expect(result).not.toBeNull();
    expect(result?.scheme).toBe("exact");
    expect(result?.network).toBe("solana-devnet");
    expect(result?.maxAmountRequired).toBe("100000");
    expect(result?.payTo).toBe(FAKE_PAYTO);
    expect(result?.asset).toBe(FAKE_MINT);
  });

  it("picks first Solana entry, skips EVM entries", () => {
    const body = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "ethereum",
          maxAmountRequired: "100",
          payTo: "0xdeadbeef",
          asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        },
        {
          scheme: "exact",
          network: "solana-devnet",
          maxAmountRequired: "100000",
          payTo: FAKE_PAYTO,
          asset: FAKE_MINT,
        },
      ],
    };
    const result = parsePaymentRequirements(body);
    expect(result?.network).toBe("solana-devnet");
    expect(result?.payTo).toBe(FAKE_PAYTO);
  });

  it("returns null when accepts has no Solana entry", () => {
    const body = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "ethereum",
          maxAmountRequired: "100",
          payTo: "0xdeadbeef",
          asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        },
      ],
    };
    expect(parsePaymentRequirements(body)).toBeNull();
  });
});

describe("parsePaymentRequirements – Faremeter format", () => {
  it("parses recipientWallet, tokenAccount, mint, amount, cluster:devnet", () => {
    const body = {
      payment: {
        recipientWallet: FAKE_PAYTO,
        tokenAccount: FAKE_TOKEN_ACCOUNT,
        mint: FAKE_MINT,
        amount: "500000",
        cluster: "devnet",
      },
    };
    const result = parsePaymentRequirements(body);
    expect(result).not.toBeNull();
    expect(result?.scheme).toBe("exact");
    expect(result?.network).toBe("solana-devnet");
    expect(result?.maxAmountRequired).toBe("500000");
    expect(result?.payTo).toBe(FAKE_PAYTO);
    expect(result?.tokenAccount).toBe(FAKE_TOKEN_ACCOUNT);
    expect(result?.asset).toBe(FAKE_MINT);
  });

  it("converts amountUSDC float → correct atomic units (1.5 → '1500000')", () => {
    const body = {
      payment: {
        recipientWallet: FAKE_PAYTO,
        mint: FAKE_MINT,
        amountUSDC: 1.5,
      },
    };
    const result = parsePaymentRequirements(body);
    expect(result?.maxAmountRequired).toBe("1500000");
  });

  it("cluster:'mainnet' → network:'solana'", () => {
    const body = {
      payment: {
        recipientWallet: FAKE_PAYTO,
        mint: FAKE_MINT,
        amount: "100000",
        cluster: "mainnet",
      },
    };
    expect(parsePaymentRequirements(body)?.network).toBe("solana");
  });

  it("cluster:'testnet' → network:'solana-testnet'", () => {
    const body = {
      payment: {
        recipientWallet: FAKE_PAYTO,
        mint: FAKE_MINT,
        amount: "100000",
        cluster: "testnet",
      },
    };
    expect(parsePaymentRequirements(body)?.network).toBe("solana-testnet");
  });
});

describe("parsePaymentRequirements – null/invalid bodies", () => {
  it("returns null for null body", () => {
    expect(parsePaymentRequirements(null)).toBeNull();
  });

  it("returns null for undefined body", () => {
    expect(parsePaymentRequirements(undefined)).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(parsePaymentRequirements({})).toBeNull();
  });

  it("returns null for object with x402Version but no accepts", () => {
    expect(parsePaymentRequirements({ x402Version: 1 })).toBeNull();
  });

  it("returns null for non-x402 body", () => {
    expect(parsePaymentRequirements({ foo: "bar", baz: 42 })).toBeNull();
  });

  it("returns null for string body", () => {
    expect(parsePaymentRequirements("not an object")).toBeNull();
  });
});

describe("parsePaymentRequirements – v2 PAYMENT-REQUIRED header", () => {
  it("header takes precedence over body", () => {
    const coinbaseBody = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "solana-devnet",
          maxAmountRequired: "100000",
          payTo: FAKE_PAYTO,
          asset: FAKE_MINT,
        },
      ],
    };

    const headerData = {
      accepts: [
        {
          scheme: "exact",
          network: "solana",
          maxAmountRequired: "200000",
          payTo: "So11111111111111111111111111111111111111112",
          asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        },
      ],
    };
    const header = Buffer.from(JSON.stringify(headerData)).toString("base64");

    const result = parsePaymentRequirements(coinbaseBody, header);
    // Header values should win
    expect(result?.network).toBe("solana");
    expect(result?.maxAmountRequired).toBe("200000");
    expect(result?.payTo).toBe("So11111111111111111111111111111111111111112");
  });

  it("falls back to body if header is invalid base64 JSON", () => {
    const coinbaseBody = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "solana-devnet",
          maxAmountRequired: "100000",
          payTo: FAKE_PAYTO,
          asset: FAKE_MINT,
        },
      ],
    };

    const result = parsePaymentRequirements(coinbaseBody, "not-valid-base64-json!!!");
    // Invalid header → falls back to body
    expect(result?.network).toBe("solana-devnet");
    expect(result?.maxAmountRequired).toBe("100000");
  });
});
