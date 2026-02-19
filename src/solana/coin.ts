/**
 * Solana BELLACOIN Operations
 *
 * BELLACOIN on Solana via SPL Token program.
 *
 * BELLACOIN Mint Addresses:
 * - Mainnet: <REPLACE_WITH_MAINNET_MINT_ADDRESS>
 * - Devnet:  <REPLACE_WITH_DEVNET_MINT_ADDRESS>
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { UsdcBalanceResult, SolanaPaymentResult } from "../types.js";

// Re-use the same balance/payment result types — you can rename them in
// types.ts later (e.g. TokenBalanceResult / SolanaPaymentResult).

export type BellacoinBalanceResult = {
  balance: number;
  network: string;
  ok: boolean;
  error?: string;
};

// ─── Connection pool ──────────────────────────────────────────

const connectionCache = new Map<string, Connection>();

function getConnection(network: string, rpcUrl?: string): Connection {
  const url = getRpcUrl(network, rpcUrl);
  let conn = connectionCache.get(url);
  if (!conn) {
    conn = new Connection(url, "confirmed");
    connectionCache.set(url, conn);
  }
  return conn;
}

// ─── BELLACOIN Mint Addresses ─────────────────────────────────
// ⚠️  Replace these with the real mint addresses of $BELLACOIN

export const BELLACOIN_MINTS: Record<string, PublicKey> = {
  "mainnet-beta": new PublicKey("REPLACE_WITH_MAINNET_MINT_ADDRESS"),
  devnet: new PublicKey("REPLACE_WITH_DEVNET_MINT_ADDRESS"),
  testnet: new PublicKey("REPLACE_WITH_DEVNET_MINT_ADDRESS"),
};

// Change this if $BELLACOIN uses a different number of decimals
export const BELLACOIN_DECIMALS = 9;

/**
 * Get the RPC URL for a Solana network.
 */
export function getRpcUrl(network: string, customRpcUrl?: string): string {
  if (customRpcUrl) return customRpcUrl;
  switch (network) {
    case "mainnet-beta":
      return "https://api.mainnet-beta.solana.com";
    case "devnet":
      return "https://api.devnet.solana.com";
    case "testnet":
      return "https://api.testnet.solana.com";
    default:
      return "https://api.mainnet-beta.solana.com";
  }
}

/**
 * Get the BELLACOIN balance for a wallet on Solana.
 */
export async function getBellacoinBalance(
  walletAddress: string,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<number> {
  const result = await getBellacoinBalanceDetailed(walletAddress, network, rpcUrl);
  return result.balance;
}

/**
 * Get the BELLACOIN balance with detailed status info.
 */
export async function getBellacoinBalanceDetailed(
  walletAddress: string,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<BellacoinBalanceResult> {
  const bellacoinMint = BELLACOIN_MINTS[network];
  if (!bellacoinMint) {
    return {
      balance: 0,
      network,
      ok: false,
      error: `Unsupported BELLACOIN network: ${network}`,
    };
  }

  try {
    const connection = getConnection(network, rpcUrl);
    const walletPubkey = new PublicKey(walletAddress);

    // Derive the associated token account (ATA) address — no network call.
    const tokenAccount = await getAssociatedTokenAddress(
      bellacoinMint,
      walletPubkey,
    );

    // Check existence via getAccountInfo — returns null if ATA doesn't exist.
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (accountInfo === null) {
      // ATA has not been created yet; wallet holds 0 BELLACOIN.
      return { balance: 0, network, ok: true };
    }

    const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
    const balance = tokenBalance.value.uiAmount ?? 0;

    return { balance, network, ok: true };
  } catch (err: any) {
    return {
      balance: 0,
      network,
      ok: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Get the SOL balance for a wallet.
 */
export async function getSolBalance(
  walletAddress: string,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<number> {
  try {
    const connection = getConnection(network, rpcUrl);
    const walletPubkey = new PublicKey(walletAddress);
    const lamports = await connection.getBalance(walletPubkey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

/**
 * Transfer BELLACOIN on Solana (SPL token transfer).
 */
export async function transferBellacoin(
  fromKeypair: Keypair,
  toAddress: string,
  amount: number,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<SolanaPaymentResult> {
  const bellacoinMint = BELLACOIN_MINTS[network];
  if (!bellacoinMint) {
    return { success: false, error: `Unsupported network: ${network}` };
  }

  try {
    const connection = getConnection(network, rpcUrl);
    const toPubkey = new PublicKey(toAddress);
    const rawAmount = Math.floor(amount * 10 ** BELLACOIN_DECIMALS);

    // Get or create source ATA
    const fromAta = await getOrCreateAssociatedTokenAccount(
      connection,
      fromKeypair,
      bellacoinMint,
      fromKeypair.publicKey,
    );

    // Get or create destination ATA
    const toAta = await getOrCreateAssociatedTokenAccount(
      connection,
      fromKeypair,
      bellacoinMint,
      toPubkey,
    );

    // Build transfer instruction
    const transferIx = createTransferInstruction(
      fromAta.address,
      toAta.address,
      fromKeypair.publicKey,
      rawAmount,
    );

    const transaction = new Transaction().add(transferIx);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;

    const signature = await connection.sendTransaction(transaction, [fromKeypair]);
    await connection.confirmTransaction(signature, "confirmed");

    return { success: true, signature };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Transfer SOL (native token).
 */
export async function transferSol(
  fromKeypair: Keypair,
  toAddress: string,
  amountSol: number,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<SolanaPaymentResult> {
  try {
    const connection = getConnection(network, rpcUrl);
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey,
        lamports,
      }),
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;

    const signature = await connection.sendTransaction(transaction, [fromKeypair]);
    await connection.confirmTransaction(signature, "confirmed");

    return { success: true, signature };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
