export class ConfigurationError extends Error {
  override name = "ConfigurationError";
  constructor(message: string, readonly source?: string) { super(source ? `${source}: ${message}` : message); }
}
export class RepositoryDiscoveryError extends Error { override name = "RepositoryDiscoveryError"; }
