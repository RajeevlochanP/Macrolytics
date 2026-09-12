import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { CompactEncrypt, compactDecrypt } from 'jose';

export default class AgentController {
  constructor(appGraph, authService) {
    this.appGraph = appGraph;
    this.authService = authService;
    // ensure 32 bytes for A256GCM direct encryption
    const key = process.env.CONTEXT_ENCRYPTION_KEY || '12345678901234567890123456789012';
    this.secretKey = new TextEncoder().encode(key.padEnd(32, '0').substring(0, 32));
  }

  async initialize() {
    this.agent = await this.appGraph.compile(); // Stateless, no checkpointer
  }

  async decryptContext(encryptedContext) {
    if (!encryptedContext) return { summary: "", recentMessages: [] };
    try {
      const { plaintext } = await compactDecrypt(encryptedContext, this.secretKey);
      const decoded = new TextDecoder().decode(plaintext);
      return JSON.parse(decoded);
    } catch (e) {
      console.warn("Failed to decrypt context, starting fresh:", e.message);
      return { summary: "", recentMessages: [] };
    }
  }

  async encryptContext(contextObj) {
    const encoded = new TextEncoder().encode(JSON.stringify(contextObj));
    return await new CompactEncrypt(encoded)
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .encrypt(this.secretKey);
  }

  hydrateMessages(messagesData) {
    return messagesData.map(m => {
      if (m.type === 'human') return new HumanMessage(m.content);
      if (m.type === 'ai') return new AIMessage(m.content);
      if (m.type === 'system') return new SystemMessage(m.content);
      return new HumanMessage(m.content);
    });
  }

  serializeMessages(messages) {
    return messages.map(m => {
      const type = m._getType ? m._getType() : m.id ? m.id[m.id.length - 1].replace('Message', '').toLowerCase() : 'unknown';
      return { type, content: m.content };
    });
  }

  chat = async (req, res) => {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const { message, encryptedContext } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }

      const context = await this.decryptContext(encryptedContext);
      const preferences = await this.authService.getUserPreferences(userId);

      const hydratedMessages = this.hydrateMessages(context.recentMessages);
      hydratedMessages.push(new HumanMessage(message));

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const timeZone = req.headers['x-timezone'] || 'UTC';

      const inputState = {
        messages: hydratedMessages,
        summary: context.summary,
        preferences,
        timeZone
      };

      const stream = await this.agent.streamEvents(inputState, { version: "v2" });

      let finalState = null;

      for await (const event of stream) {
        if (event.event === "on_chat_model_stream") {
          const content = event.data.chunk.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ token: content })}\n\n`);
          }
        } else if (event.event === "on_chain_end" && !event.name.includes("ChatOllama") && event.data.output?.messages) {
          // Capture the top-level workflow output which contains the updated state
          finalState = event.data.output;
        }
      }

      // If we got the final state, prepare the new context
      let newSummary = context.summary;
      let newRecentMessages = context.recentMessages;

      if (finalState) {
        if (finalState.summary) newSummary = finalState.summary;
        if (finalState.messages) {
          // graph returns ALL messages in the state, so we serialize the recent ones
          newRecentMessages = this.serializeMessages(finalState.messages);
        }
      }

      const newEncryptedContext = await this.encryptContext({
        summary: newSummary,
        recentMessages: newRecentMessages
      });

      res.write(`data: ${JSON.stringify({ encryptedContext: newEncryptedContext, done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error(error);
      res.status(500).write(`data: ${JSON.stringify({ error: 'Internal Server Error' })}\n\n`);
      res.end();
    }
  }
}
