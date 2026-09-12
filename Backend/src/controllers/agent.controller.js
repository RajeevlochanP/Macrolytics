import { HumanMessage } from '@langchain/core/messages';

export default class AgentController {
  constructor(appGraph, checkpointer) {
    this.appGraph = appGraph;
    this.checkpointer = checkpointer;
  }

  async initialize() {
    this.agent = await this.appGraph.compile({ checkpointer: this.checkpointer });
  }

  chat = async (req, res) => {
    try {
      const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const { message, threadId } = req.body;

      if (!message || !threadId) {
        return res.status(400).json({ error: 'message and threadId are required' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const config = { configurable: { thread_id: threadId } };
      
      const stream = await this.agent.streamEvents(
        { messages: [new HumanMessage(message)] },
        { ...config, version: "v2" }
      );

      for await (const event of stream) {
        if (event.event === "on_chat_model_stream") {
          const content = event.data.chunk.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ token: content })}\n\n`);
          }
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error(error);
      res.status(500).write(`data: ${JSON.stringify({ error: 'Internal Server Error' })}\n\n`);
      res.end();
    }
  }
}
