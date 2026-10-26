import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { callTool, tools, DISCLAIMER } from './tools';

// SDK transport and protocol; Zod validation stays in callTool so errors are in pt-BR.
const server = new Server({name:'starkx-mcp',version:'0.1.0'},{capabilities:{tools:{}},instructions:DISCLAIMER});
server.setRequestHandler(ListToolsRequestSchema,async () => ({tools:tools.map(({name,description,inputSchema})=>({name,description,inputSchema}))}));
server.setRequestHandler(CallToolRequestSchema,async request => callTool(request.params.name,request.params.arguments ?? {}));
await server.connect(new StdioServerTransport());
