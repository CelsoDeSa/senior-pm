export interface HandoffIntent { artifactBase: string; target: string }
export class HandoffNonceStore {
  private readonly values = new Map<string, HandoffIntent & { expires: number }>();
  constructor(private readonly ttlMs = 60_000, private readonly now = () => Date.now()) {}
  issue(sessionID: string, intent: HandoffIntent) { this.values.set(sessionID, { ...intent, expires: this.now() + this.ttlMs }); }
  consume(sessionID: string, intent: HandoffIntent) { const value = this.values.get(sessionID); this.values.delete(sessionID); return !!value && value.expires >= this.now() && value.artifactBase === intent.artifactBase && value.target === intent.target; }
}
