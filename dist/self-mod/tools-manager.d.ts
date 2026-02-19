/**
 * Tools Manager
 *
 * Manages installation and configuration of external tools and MCP servers.
 */
import type { SolanaAgentClient, AutomatonDatabase, InstalledTool } from "../types.js";
/**
 * Install an npm package globally in the sandbox.
 */
export declare function installNpmPackage(agentClient: SolanaAgentClient, db: AutomatonDatabase, packageName: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Install an MCP server.
 * The automaton can add new capabilities by installing MCP servers.
 */
export declare function installMcpServer(agentClient: SolanaAgentClient, db: AutomatonDatabase, name: string, command: string, args?: string[], env?: Record<string, string>): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * List all installed tools.
 */
export declare function listInstalledTools(db: AutomatonDatabase): InstalledTool[];
/**
 * Remove (disable) an installed tool.
 */
export declare function removeTool(db: AutomatonDatabase, toolId: string): void;
//# sourceMappingURL=tools-manager.d.ts.map