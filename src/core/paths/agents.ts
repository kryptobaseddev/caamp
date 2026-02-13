import { getAgentsHome, getCanonicalSkillsDir, getLockFilePath } from "./standard.js";

export const AGENTS_HOME = getAgentsHome();
export const LOCK_FILE_PATH = getLockFilePath();
export const CANONICAL_SKILLS_DIR = getCanonicalSkillsDir();
