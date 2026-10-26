import fetch from 'node-fetch';

export interface ReplitConfig {
  token: string;
  replId?: string;
}

export interface FileInfo {
  path: string;
  type: 'file' | 'directory';
}

export interface ReplInfo {
  id: string;
  slug: string;
  title: string;
  description: string;
  language: string;
  url: string;
}

interface MutationResult {
  __typename: string;
  message?: string;
}

const GRAPHQL_URL = 'https://replit.com/graphql';

export class ReplitClient {
  private token: string;
  private replId?: string;

  constructor(config: ReplitConfig) {
    this.token = config.token;
    this.replId = config.replId;
  }

  private async query(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `connect.sid=${this.token}`,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Replit-MCP-Server/1.0',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { data?: unknown; errors?: Array<{ message: string }> };
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(`GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return result.data;
  }

  private checkMutationResult(result: MutationResult | null, successType: string, operation: string): void {
    if (!result) {
      throw new Error(`${operation} failed: No response from server`);
    }
    if (result.__typename !== successType) {
      throw new Error(`${operation} failed: ${result.message || 'Unknown error'}`);
    }
  }

  setReplId(replId: string): void {
    this.replId = replId;
  }

  async getCurrentUser(): Promise<{ id: string; username: string; email: string } | null> {
    const query = `
      query CurrentUser {
        currentUser {
          id
          username
          email
        }
      }
    `;

    const data = await this.query(query) as { currentUser: { id: string; username: string; email: string } | null };
    return data.currentUser;
  }

  async getReplByUrl(url: string): Promise<ReplInfo | null> {
    const query = `
      query ReplByUrl($url: String!) {
        repl(url: $url) {
          id
          slug
          title
          description
          templateInfo {
            label
          }
          url
        }
      }
    `;

    const data = await this.query(query, { url }) as { repl: { id: string; slug: string; title: string; description: string; templateInfo?: { label: string }; url: string } | null };
    if (!data.repl) return null;
    
    return {
      id: data.repl.id,
      slug: data.repl.slug,
      title: data.repl.title,
      description: data.repl.description,
      language: data.repl.templateInfo?.label || 'unknown',
      url: data.repl.url,
    };
  }

  async listUserRepls(limit: number = 20): Promise<ReplInfo[]> {
    const query = `
      query UserRepls($limit: Int!) {
        currentUser {
          repls(count: $limit) {
            items {
              id
              slug
              title
              description
              templateInfo {
                label
              }
              url
            }
          }
        }
      }
    `;

    const data = await this.query(query, { limit }) as { 
      currentUser: { 
        repls: { 
          items: Array<{ id: string; slug: string; title: string; description: string; templateInfo?: { label: string }; url: string }> 
        } 
      } | null 
    };
    
    if (!data.currentUser) {
      throw new Error('Failed to get user repls: User not authenticated or no access');
    }
    
    return data.currentUser.repls.items.map(repl => ({
      id: repl.id,
      slug: repl.slug,
      title: repl.title,
      description: repl.description,
      language: repl.templateInfo?.label || 'unknown',
      url: repl.url,
    }));
  }

  async readFile(path: string, replId?: string): Promise<string> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      query ReadFile($replId: String!, $path: String!) {
        repl(id: $replId) {
          ... on Repl {
            fileByPath(path: $path) {
              ... on File {
                content
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path }) as {
      repl: { fileByPath: { content: string } | null } | null
    };

    if (!data.repl) {
      throw new Error(`Repl not found or no access: ${targetReplId}`);
    }

    if (!data.repl.fileByPath) {
      throw new Error(`File not found: ${path}`);
    }

    return data.repl.fileByPath.content;
  }

  async writeFile(path: string, content: string, replId?: string): Promise<boolean> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation WriteFile($replId: String!, $path: String!, $content: String!) {
        writeFile(replId: $replId, path: $path, content: $content) {
          __typename
          ... on WriteFileError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path, content }) as {
      writeFile: MutationResult | null
    };
    
    this.checkMutationResult(data.writeFile, 'WriteFileSuccess', `Write file "${path}"`);
    return true;
  }

  async listFiles(path: string = '.', replId?: string): Promise<FileInfo[]> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      query ListFiles($replId: String!, $path: String!) {
        repl(id: $replId) {
          ... on Repl {
            fileByPath(path: $path) {
              ... on Directory {
                children {
                  filename
                  ... on File {
                    __typename
                  }
                  ... on Directory {
                    __typename
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path }) as {
      repl: { 
        fileByPath: { 
          children: Array<{ filename: string; __typename: string }> 
        } | null 
      } | null
    };

    if (!data.repl) {
      throw new Error(`Repl not found or no access: ${targetReplId}`);
    }

    if (!data.repl.fileByPath) {
      throw new Error(`Directory not found: ${path}`);
    }

    return data.repl.fileByPath.children.map(child => ({
      path: child.filename,
      type: child.__typename === 'Directory' ? 'directory' : 'file',
    }));
  }

  async createFile(path: string, content: string = '', replId?: string): Promise<boolean> {
    return this.writeFile(path, content, replId);
  }

  async deleteFile(path: string, replId?: string): Promise<boolean> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation DeleteFile($replId: String!, $path: String!) {
        deleteFile(replId: $replId, path: $path) {
          __typename
          ... on DeleteFileError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path }) as {
      deleteFile: MutationResult | null
    };
    
    this.checkMutationResult(data.deleteFile, 'DeleteFileSuccess', `Delete file "${path}"`);
    return true;
  }

  async createDirectory(path: string, replId?: string): Promise<boolean> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation CreateDirectory($replId: String!, $path: String!) {
        createDirectory(replId: $replId, path: $path) {
          __typename
          ... on CreateDirectoryError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path }) as {
      createDirectory: MutationResult | null
    };
    
    this.checkMutationResult(data.createDirectory, 'CreateDirectorySuccess', `Create directory "${path}"`);
    return true;
  }

  async runRepl(replId?: string): Promise<{ success: boolean; message: string }> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation RunRepl($replId: String!) {
        runRepl(replId: $replId) {
          __typename
          ... on RunReplError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId }) as {
      runRepl: MutationResult | null
    };

    if (!data.runRepl) {
      return { success: false, message: 'No response from server' };
    }

    if (data.runRepl.__typename !== 'RunReplSuccess') {
      return { success: false, message: data.runRepl.message || 'Failed to start repl' };
    }

    return { success: true, message: 'Repl started successfully' };
  }

  async stopRepl(replId?: string): Promise<{ success: boolean; message: string }> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation StopRepl($replId: String!) {
        stopRepl(replId: $replId) {
          __typename
          ... on StopReplError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId }) as {
      stopRepl: MutationResult | null
    };

    if (!data.stopRepl) {
      return { success: false, message: 'No response from server' };
    }

    if (data.stopRepl.__typename !== 'StopReplSuccess') {
      return { success: false, message: data.stopRepl.message || 'Failed to stop repl' };
    }

    return { success: true, message: 'Repl stopped successfully' };
  }

  async searchFiles(query_str: string, replId?: string): Promise<Array<{ path: string; matches: string[] }>> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const gqlQuery = `
      query SearchFiles($replId: String!, $query: String!) {
        repl(id: $replId) {
          ... on Repl {
            search(query: $query) {
              results {
                path
                matches
              }
            }
          }
        }
      }
    `;

    const data = await this.query(gqlQuery, { replId: targetReplId, query: query_str }) as {
      repl: { search: { results: Array<{ path: string; matches: string[] }> } | null } | null
    };

    if (!data.repl) {
      throw new Error(`Repl not found or no access: ${targetReplId}`);
    }

    if (!data.repl.search) {
      return [];
    }

    return data.repl.search.results;
  }

  async getUserById(id: number): Promise<{ id: string; username: string; bio: string; isHacker: boolean; timeCreated: string } | null> {
    const query = `
      query UserById($id: Int!) {
        user(id: $id) {
          id
          username
          bio
          isHacker
          timeCreated
        }
      }
    `;

    const data = await this.query(query, { id }) as { user: { id: string; username: string; bio: string; isHacker: boolean; timeCreated: string } | null };
    return data.user;
  }

  async getUserByUsername(username: string): Promise<{ id: string; username: string; bio: string; isHacker: boolean; timeCreated: string } | null> {
    const query = `
      query UserByUsername($username: String!) {
        userByUsername(username: $username) {
          id
          username
          bio
          isHacker
          timeCreated
        }
      }
    `;

    const data = await this.query(query, { username }) as { userByUsername: { id: string; username: string; bio: string; isHacker: boolean; timeCreated: string } | null };
    return data.userByUsername;
  }

  async createRepl(input: { title: string; language: string; description?: string; isPrivate?: boolean }): Promise<ReplInfo> {
    const query = `
      mutation CreateRepl($input: CreateReplInput!) {
        createRepl(input: $input) {
          __typename
          ... on Repl {
            id
            slug
            title
            description
            templateInfo {
              label
            }
            url
          }
          ... on UserError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { input }) as {
      createRepl: { __typename: string; id?: string; slug?: string; title?: string; description?: string; templateInfo?: { label: string }; url?: string; message?: string }
    };

    if (data.createRepl.__typename === 'UserError') {
      throw new Error(`Create repl failed: ${data.createRepl.message}`);
    }

    return {
      id: data.createRepl.id!,
      slug: data.createRepl.slug!,
      title: data.createRepl.title!,
      description: data.createRepl.description || '',
      language: data.createRepl.templateInfo?.label || 'unknown',
      url: data.createRepl.url!,
    };
  }

  async forkRepl(url: string): Promise<ReplInfo> {
    const query = `
      mutation ForkRepl($url: String!) {
        forkRepl(url: $url) {
          __typename
          ... on Repl {
            id
            slug
            title
            description
            templateInfo {
              label
            }
            url
          }
          ... on UserError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { url }) as {
      forkRepl: { __typename: string; id?: string; slug?: string; title?: string; description?: string; templateInfo?: { label: string }; url?: string; message?: string }
    };

    if (data.forkRepl.__typename === 'UserError') {
      throw new Error(`Fork repl failed: ${data.forkRepl.message}`);
    }

    return {
      id: data.forkRepl.id!,
      slug: data.forkRepl.slug!,
      title: data.forkRepl.title!,
      description: data.forkRepl.description || '',
      language: data.forkRepl.templateInfo?.label || 'unknown',
      url: data.forkRepl.url!,
    };
  }

  async deleteRepl(id: string, confirm: boolean): Promise<{ success: boolean; message: string }> {
    if (!confirm) {
      throw new Error('Delete repl requires confirmation. Set confirm to true to proceed.');
    }

    const query = `
      mutation DeleteRepl($id: String!) {
        deleteRepl(id: $id) {
          id
        }
      }
    `;

    const data = await this.query(query, { id }) as {
      deleteRepl: { id: string } | null
    };

    if (!data.deleteRepl) {
      throw new Error('Delete repl failed: No response from server');
    }

    return { success: true, message: `Repl ${id} deleted successfully` };
  }

  async getSecrets(replId?: string): Promise<Array<{ key: string; value: string }>> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      query GetSecrets($replId: String!) {
        repl(id: $replId) {
          ... on Repl {
            environmentVariables {
              key
              value
            }
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId }) as {
      repl: { environmentVariables: Array<{ key: string; value: string }> } | null
    };

    if (!data.repl) {
      throw new Error(`Repl not found or no access: ${targetReplId}`);
    }

    return data.repl.environmentVariables || [];
  }

  async setSecret(key: string, value: string, replId?: string): Promise<{ key: string; value: string }> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation SetEnvironmentVariable($replId: String!, $key: String!, $value: String!) {
        setEnvironmentVariable(replId: $replId, key: $key, value: $value) {
          key
          value
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, key, value }) as {
      setEnvironmentVariable: { key: string; value: string } | null
    };

    if (!data.setEnvironmentVariable) {
      throw new Error('Set environment variable failed: No response from server');
    }

    return data.setEnvironmentVariable;
  }

  async deleteSecret(key: string, replId?: string): Promise<{ success: boolean; message: string }> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation DeleteEnvironmentVariable($replId: String!, $key: String!) {
        deleteEnvironmentVariable(replId: $replId, key: $key)
      }
    `;

    await this.query(query, { replId: targetReplId, key });

    return { success: true, message: `Environment variable "${key}" deleted successfully` };
  }

  async getDeployment(replId?: string): Promise<{ id: string; status: string; url: string } | null> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      query GetDeployment($replId: String!) {
        repl(id: $replId) {
          ... on Repl {
            currentDeployment {
              id
              status
              url
            }
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId }) as {
      repl: { currentDeployment: { id: string; status: string; url: string } | null } | null
    };

    if (!data.repl) {
      throw new Error(`Repl not found or no access: ${targetReplId}`);
    }

    return data.repl.currentDeployment;
  }

  async createDeployment(replId?: string): Promise<{ success: boolean; message: string; deploymentId?: string }> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation CreateDeployment($replId: String!) {
        deployRepl(replId: $replId) {
          __typename
          ... on DeployReplSuccess {
            deployment {
              id
              status
              url
            }
          }
          ... on UserError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId }) as {
      deployRepl: { __typename: string; deployment?: { id: string; status: string; url: string }; message?: string }
    };

    if (data.deployRepl.__typename === 'UserError') {
      throw new Error(`Deploy repl failed: ${data.deployRepl.message}`);
    }

    return {
      success: true,
      message: 'Deployment initiated successfully',
      deploymentId: data.deployRepl.deployment?.id,
    };
  }

  async getReplDetails(replId?: string, url?: string): Promise<{
    id: string;
    slug: string;
    title: string;
    description: string;
    language: string;
    url: string;
    runCount: number;
    likeCount: number;
    forkCount: number;
    tags: string[];
    isPrivate: boolean;
    multiplayers: Array<{ username: string }>;
    comments: Array<{ id: string; body: string; user: { username: string } }>;
  }> {
    let queryVar: Record<string, unknown> = {};
    let replSelector = '';
    let varDecl = '';
    
    if (replId) {
      queryVar = { replId };
      replSelector = 'repl(id: $replId)';
      varDecl = '$replId: String!';
    } else if (url) {
      queryVar = { url };
      replSelector = 'repl(url: $url)';
      varDecl = '$url: String!';
    } else if (this.replId) {
      queryVar = { replId: this.replId };
      replSelector = 'repl(id: $replId)';
      varDecl = '$replId: String!';
    } else {
      throw new Error('No repl ID or URL specified. Please provide a replId, url, or set a default repl.');
    }

    const query = `
      query GetReplDetails(${varDecl}) {
        ${replSelector} {
          ... on Repl {
            id
            slug
            title
            description
            templateInfo {
              label
            }
            url
            runCount
            likeCount
            forkCount
            tags
            isPrivate
            multiplayers {
              username
            }
            comments {
              items {
                id
                body
                user {
                  username
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, queryVar) as {
      repl: {
        id: string;
        slug: string;
        title: string;
        description: string;
        templateInfo?: { label: string };
        url: string;
        runCount: number;
        likeCount: number;
        forkCount: number;
        tags: string[];
        isPrivate: boolean;
        multiplayers: Array<{ username: string }>;
        comments: { items: Array<{ id: string; body: string; user: { username: string } }> };
      } | null
    };

    if (!data.repl) {
      throw new Error('Repl not found or no access');
    }

    return {
      id: data.repl.id,
      slug: data.repl.slug,
      title: data.repl.title,
      description: data.repl.description,
      language: data.repl.templateInfo?.label || 'unknown',
      url: data.repl.url,
      runCount: data.repl.runCount,
      likeCount: data.repl.likeCount,
      forkCount: data.repl.forkCount,
      tags: data.repl.tags || [],
      isPrivate: data.repl.isPrivate,
      multiplayers: data.repl.multiplayers || [],
      comments: data.repl.comments?.items || [],
    };
  }
}
