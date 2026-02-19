/**
 * Skills Registry
 *
 * Install skills from remote sources:
 * - Git repos: git clone <url> ~/.automaton/skills/<name>
 * - URLs: fetch a SKILL.md from any URL
 * - Self-created: the automaton writes its own SKILL.md files
 */
import type { Skill, AutomatonDatabase, SolanaAgentClient } from "../types.js";
/**
 * Install a skill from a git repository.
 * Clones the repo into ~/.automaton/skills/<name>/
 */
export declare function installSkillFromGit(repoUrl: string, name: string, skillsDir: string, db: AutomatonDatabase, agentClient: SolanaAgentClient): Promise<Skill | null>;
/**
 * Install a skill from a URL (fetches a single SKILL.md).
 */
export declare function installSkillFromUrl(url: string, name: string, skillsDir: string, db: AutomatonDatabase, agentClient: SolanaAgentClient): Promise<Skill | null>;
/**
 * Create a new skill authored by the automaton itself.
 */
export declare function createSkill(name: string, description: string, instructions: string, skillsDir: string, db: AutomatonDatabase, agentClient: SolanaAgentClient): Promise<Skill>;
/**
 * Remove a skill (disable in DB and optionally delete from disk).
 */
export declare function removeSkill(name: string, db: AutomatonDatabase, agentClient: SolanaAgentClient, skillsDir: string, deleteFiles?: boolean): Promise<void>;
/**
 * List all installed skills.
 */
export declare function listSkills(db: AutomatonDatabase): Skill[];
//# sourceMappingURL=registry.d.ts.map