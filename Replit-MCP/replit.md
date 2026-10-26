# Replit MCP Server

## Overview
A comprehensive Model Context Protocol (MCP) server that enables AI assistants to interact with Replit workspaces directly via the Replit GraphQL API. Deployable on Smithery.

## Project Architecture

### Structure
```
├── src/
│   ├── index.ts         # Main MCP server entry point with 24 tools
│   └── replit-client.ts # Replit GraphQL API client
├── dist/                # Compiled JavaScript output
├── Dockerfile           # Container for Smithery deployment
├── smithery.json        # Smithery registry metadata
├── package.json         # Node.js dependencies
└── tsconfig.json        # TypeScript configuration
```

### Key Technologies
- **TypeScript** - Main language
- **@modelcontextprotocol/sdk** - MCP SDK for building the server
- **node-fetch** - HTTP client for GraphQL requests
- **Smithery** - Deployment platform

### MCP Tools Available (24 Total)

#### User Operations
1. **get_current_user** - Get authenticated user info
2. **get_user_by_id** - Get user by numeric ID
3. **get_user_by_username** - Get user by username

#### Repl Management
4. **list_repls** - List user's repls
5. **get_repl_by_url** - Get repl info by URL
6. **get_repl_details** - Get detailed repl info (comments, multiplayers, tags, stats)
7. **set_active_repl** - Set active repl for subsequent operations
8. **create_repl** - Create a new repl
9. **fork_repl** - Fork an existing repl
10. **delete_repl** - Delete a repl (requires confirmation)
11. **run_repl** - Start a repl
12. **stop_repl** - Stop a repl

#### File Operations
13. **read_file** - Read file contents
14. **write_file** - Write to files
15. **list_files** - List directory contents
16. **create_file** - Create new files
17. **delete_file** - Delete files
18. **create_directory** - Create directories
19. **search_files** - Search file contents

#### Environment Variables
20. **get_secrets** - List environment variables
21. **set_secret** - Set environment variable
22. **delete_secret** - Delete environment variable

#### Deployments
23. **get_deployment** - Get deployment info
24. **create_deployment** - Deploy/publish a repl

### Authentication
Uses Replit's `connect.sid` cookie token for GraphQL API authentication. Token is passed via `REPLIT_TOKEN` environment variable.

### Deployment
- **Smithery**: Docker-based deployment with automatic scaling
- **Local**: `npm run dev` for development, `npm start` for production

## Development Commands
- `npm install` - Install dependencies
- `npm run build` - Compile TypeScript
- `npm run dev` - Run in development mode
- `npm start` - Run production build

## Recent Changes
- Expanded from 13 to 24 tools for comprehensive API coverage
- Added user lookup operations (by ID and username)
- Added repl creation, forking, and deletion
- Added environment variable/secrets management
- Added deployment operations
- Added detailed repl info with stats (comments, likes, forks, etc.)
- Improved error handling with proper mutation result checking
