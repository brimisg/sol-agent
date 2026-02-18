import { describe, it, expect, beforeEach, vi } from "vitest";
import { createBuiltinTools } from "../../agent/tools.js";
import type { ToolContext } from "../../types.js";

const SANDBOX_ID = "test-sandbox-abc123";

const mockExec = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });

const mockCtx = {
  identity: { sandboxId: SANDBOX_ID } as ToolContext["identity"],
  conway: { exec: mockExec } as unknown as ToolContext["conway"],
  config: {} as ToolContext["config"],
  db: {} as ToolContext["db"],
  inference: {} as ToolContext["inference"],
} as ToolContext;

let execTool: (typeof ReturnType<typeof createBuiltinTools>)[number];

beforeEach(() => {
  mockExec.mockClear();
  const tools = createBuiltinTools(SANDBOX_ID);
  const found = tools.find((t) => t.name === "exec");
  if (!found) throw new Error("exec tool not found");
  execTool = found;
});

describe("exec tool – forbidden commands (self-preservation guard)", () => {
  it("blocks: rm -rf ~/.sol-automaton", async () => {
    const result = await execTool.execute({ command: "rm -rf ~/.sol-automaton" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: rm -rf state.db", async () => {
    const result = await execTool.execute({ command: "rm -rf state.db" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: cat wallet.json", async () => {
    const result = await execTool.execute({ command: "cat wallet.json" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: cat .env", async () => {
    const result = await execTool.execute({ command: "cat .env" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: DROP TABLE", async () => {
    const result = await execTool.execute({ command: "DROP TABLE users" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: DELETE FROM turns", async () => {
    const result = await execTool.execute(
      { command: "DELETE FROM turns WHERE id = '1'" },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: kill automaton", async () => {
    const result = await execTool.execute({ command: "kill automaton" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: pkill automaton", async () => {
    const result = await execTool.execute({ command: "pkill automaton" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: TRUNCATE", async () => {
    const result = await execTool.execute({ command: "TRUNCATE TABLE turns" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: sandbox_delete with own sandboxId", async () => {
    const result = await execTool.execute(
      { command: `sandbox_delete ${SANDBOX_ID}` },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });
});

describe("exec tool – allowed commands", () => {
  it("allows: ls", async () => {
    const result = await execTool.execute({ command: "ls" }, mockCtx);
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalledWith("ls", 30000);
  });

  it("allows: node --version", async () => {
    const result = await execTool.execute({ command: "node --version" }, mockCtx);
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalledWith("node --version", 30000);
  });

  it("allows: echo hello", async () => {
    const result = await execTool.execute({ command: "echo hello" }, mockCtx);
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalledWith("echo hello", 30000);
  });

  it("allows: rm -rf /tmp/work (not a protected path)", async () => {
    const result = await execTool.execute({ command: "rm -rf /tmp/work" }, mockCtx);
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalledWith("rm -rf /tmp/work", 30000);
  });

  it("allows: sandbox_delete with a different sandboxId", async () => {
    const result = await execTool.execute(
      { command: "sandbox_delete other-sandbox-xyz" },
      mockCtx,
    );
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalled();
  });
});
