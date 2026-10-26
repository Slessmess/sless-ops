# Replit MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to interact with Replit workspaces directly, without needing an agentic browser or constant user intervention.

## Features

- **User Management**: Get current user, lookup users by ID or username
- **Repl Management**: List, create, fork, delete, and get detailed repl information
- **File Operations**: Read, write, create, delete files and directories
- **Environment Variables**: Manage secrets and environment variables
- **Deployments**: Get deployment info and publish repls
- **Search**: Search for content within files

## Installation

### From Smithery

```bash
smithery install replit-workspace --client claude
```

### Manual Installation

1. Clone this repository
2. Install dependencies from the repository root: `pnpm install --frozen-lockfile`
3. Build: `pnpm --filter @workspace/replit-mcp-server run build`
4. Run: `pnpm --filter @workspace/replit-mcp-server run start`

## Configuration

The server requires a `REPLIT_TOKEN` environment variable containing your Replit `connect.sid` cookie token.

### Getting Your Token

1. Log into Replit in your browser
2. Open Developer Tools (F12)
3. Go to Application > Cookies > replit.com
4. Copy the value of `connect.sid`

### Claude Desktop Configuration

Add to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "replit": {
      "command": "node",
      "args": ["/path/to/replit-mcp-server/dist/index.js"],
      "env": {
        "REPLIT_TOKEN": "your-connect-sid-token"
      }
    }
  }
}
```

## Available Tools (24 Total)

### User Operations
| Tool | Description |
|------|-------------|
| `get_current_user` | Get info about the authenticated user |
| `get_user_by_id` | Get user info by numeric ID |
| `get_user_by_username` | Get user info by username |

### Repl Management
| Tool | Description |
|------|-------------|
| `list_repls` | List repls owned by the user |
| `get_repl_by_url` | Get repl info by URL |
| `get_repl_details` | Get detailed repl info (comments, multiplayers, tags, stats) |
| `set_active_repl` | Set the active repl for subsequent operations |
| `create_repl` | Create a new repl |
| `fork_repl` | Fork an existing repl |
| `delete_repl` | Delete a repl (requires confirmation) |
| `run_repl` | Start a repl |
| `stop_repl` | Stop a running repl |

### File Operations
| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Write content to a file |
| `list_files` | List files in a directory |
| `create_file` | Create a new file |
| `delete_file` | Delete a file |
| `create_directory` | Create a new directory |
| `search_files` | Search for content in files |

### Environment Variables
| Tool | Description |
|------|-------------|
| `get_secrets` | List all environment variables for a repl |
| `set_secret` | Set an environment variable |
| `delete_secret` | Delete an environment variable |

### Deployments
| Tool | Description |
|------|-------------|
| `get_deployment` | Get deployment info for a repl |
| `create_deployment` | Deploy/publish a repl |

## Development

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Run in development mode
pnpm --filter @workspace/replit-mcp-server run dev

# Build
pnpm --filter @workspace/replit-mcp-server run build

# Start production server
pnpm --filter @workspace/replit-mcp-server run start
```

## Deployment to Smithery

1. Ensure you have a `Dockerfile` and `smithery.json` in your repo
2. Push to GitHub
3. Connect your repository via Smithery dashboard
4. Deploy

## API Coverage

This MCP server provides comprehensive coverage of Replit's GraphQL API including:
- User queries and lookups
- Repl CRUD operations
- File system operations
- Environment variable management
- Deployment management
- Search functionality

## License

MIT
