// Logger that writes to stderr ONLY — stdout is the JSON-RPC channel.
export const log = {
  info: (msg: string, data?: unknown) => process.stderr.write(`[devdigest-mcp] INFO ${msg} ${data ? JSON.stringify(data) : ''}\n`),
  error: (msg: string, data?: unknown) => process.stderr.write(`[devdigest-mcp] ERROR ${msg} ${data ? JSON.stringify(data) : ''}\n`),
};
