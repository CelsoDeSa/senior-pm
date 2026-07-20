export interface RepositoryLimits { maxDepth: number; maxFiles: number; maxFileBytes: number; maxTotalBytes: number; timeoutMs: number; }
export interface Evidence { path: string; category: string; excerpt: string; }
export interface RepositoryContext {
  hostIdentifier: string; productPurpose: string[]; existingFunctionality: string[]; architecture: string[]; terminology: string[]; documentation: string[]; uiPatterns: string[]; tests: string[]; conventions: string[]; agentConfiguration: string[]; constraints: string[]; evidence: Evidence[]; missingContext: string[]; history: string[];
  containmentGuarantee: "linux-descriptor-target-verified" | "unsupported-content-skipped";
}
export interface DiscoveryFs { realpath: typeof import("node:fs/promises").realpath; readdir: typeof import("node:fs/promises").readdir; lstat: typeof import("node:fs/promises").lstat; open: typeof import("node:fs/promises").open; }
export interface DiscoverOptions { limits?: Partial<RepositoryLimits>; detailPaths?: string[]; allowHistory?: boolean; historyAuthorized?: boolean; fs?: Partial<DiscoveryFs>; now?: () => number; descriptorTarget?: (fd: number) => Promise<string>; platform?: NodeJS.Platform; historyRunner?: (descriptorRoot: string, descriptorGit: string, timeoutMs: number, env: NodeJS.ProcessEnv) => Promise<string>; }
