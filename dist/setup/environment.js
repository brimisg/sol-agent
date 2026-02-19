import fs from "fs";
import os from "os";
export function detectEnvironment() {
    // 1. Check Docker
    if (fs.existsSync("/.dockerenv")) {
        const sandboxId = process.env.HOSTNAME || os.hostname();
        return { type: "docker", sandboxId };
    }
    // 2. Fall back to platform
    return { type: process.platform, sandboxId: "" };
}
//# sourceMappingURL=environment.js.map