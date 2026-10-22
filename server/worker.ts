import { createMcpEndpoint } from './mcp/http'
import type { McpConfig } from './mcp/types'
import { createOAuthFacade } from './mcp/oauth'
import { createWidgetEndpoint } from './widget'

declare const __MCP_CONFIG__: McpConfig
interface Environment { ASSETS: { fetch(request: Request): Promise<Response> }; PRIO_MCP_COMMAND_KEY?: string }
let endpoint: ReturnType<typeof createMcpEndpoint> | undefined
let oauth: ReturnType<typeof createOAuthFacade> | undefined
let widget: ReturnType<typeof createWidgetEndpoint> | undefined
export default {
  async fetch(request: Request, environment: Environment) {
    const path = new URL(request.url).pathname
    if (path === '/api/widget') {
      widget ??= createWidgetEndpoint(__MCP_CONFIG__, environment.PRIO_MCP_COMMAND_KEY ?? '')
      return widget(request)
    }
    oauth ??= createOAuthFacade(__MCP_CONFIG__, environment.PRIO_MCP_COMMAND_KEY ?? '')
    if (['/oauth/authorize', '/oauth/token', '/oauth/register', '/.well-known/oauth-authorization-server'].includes(path)) return oauth.fetch(request)
    if (path === '/mcp' || path.startsWith('/.well-known/oauth-protected-resource')) {
      endpoint ??= createMcpEndpoint(__MCP_CONFIG__, environment.PRIO_MCP_COMMAND_KEY ?? '', { accessToken: oauth.accessToken })
      return endpoint(request)
    }
    return environment.ASSETS.fetch(request)
  },
}
