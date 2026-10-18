/** Pages secrets are configured only on production deployment, never bundled. */
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, PRIO_MCP_COMMAND_KEY: key } = process.env
if (!token || !account || !/^[a-f0-9]{64}$/.test(key ?? '')) throw new Error('MCP-Hostkonfiguration fehlt; Veröffentlichung abgebrochen.')
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/prio-krischi`, {
  method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  // PATCH updates just this binding, preserving all other Pages settings.
  body: JSON.stringify({ deployment_configs: { production: { env_vars: { PRIO_MCP_COMMAND_KEY: { type: 'secret_text', value: key } } } } }),
})
const result = await response.json()
if (!response.ok || !result.success) throw new Error(`MCP-Hostkonfiguration abgewiesen (${response.status}); keine Secrets ausgegeben.`)
console.log('Privater MCP-Befehlsschlüssel für die Produktion eingerichtet.')
