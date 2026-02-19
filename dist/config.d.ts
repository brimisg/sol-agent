/**
 * Sol-Automaton Configuration
 *
 * Loads and saves the automaton's configuration from ~/.sol-automaton/automaton.json
 */
import type { AutomatonConfig } from "./types.js";
export declare function getConfigPath(): string;
/**
 * Validate a raw (already-merged-with-defaults) config object.
 * Returns the typed config on success, or throws with a list of all
 * problems so the user can fix everything in one pass.
 */
export declare function validateConfig(raw: unknown): AutomatonConfig;
export declare function loadConfig(): AutomatonConfig | null;
export declare function saveConfig(config: AutomatonConfig): void;
export declare function resolvePath(p: string): string;
export declare function createConfig(params: {
    name: string;
    genesisPrompt: string;
    creatorMessage?: string;
    creatorAddress: string;
    walletAddress: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    parentAddress?: string;
    solanaRpcUrl?: string;
    solanaNetwork?: "mainnet-beta" | "devnet" | "testnet";
    dockerSocketPath?: string;
    dockerImage?: string;
    registeredWithConway?: boolean;
    sandboxId?: string;
    apiKey?: string;
}): AutomatonConfig;
//# sourceMappingURL=config.d.ts.map