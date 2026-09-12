import { StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ChatOllama } from '@langchain/ollama';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { SystemMessage, HumanMessage, RemoveMessage } from '@langchain/core/messages';
import { createTools } from './tools.js';

export const createAgentGraph = async (nutritionService, authService) => {
  const tools = createTools(nutritionService, authService);
  const toolNode = new ToolNode(tools);
  
  const model = new ChatOllama({
    model: 'llama3.1',
    temperature: 0,
  }).bindTools(tools);

  const AgentState = {
    messages: MessagesAnnotation.messages,
    summary: {
      value: (x, y) => y || x || "",
      default: () => ""
    },
    preferences: {
      value: (x, y) => y || x || {},
      default: () => ({})
    }
  };

  const shouldSummarize = (state) => {
    if (state.messages.length > 6) {
      return "summarize_conversation";
    }
    return "agent";
  };

  const summarizeConversation = async (state) => {
    const { messages, summary } = state;
    
    const summaryPrompt = `Distill the above chat messages into a single summary message. Include any user constraints, preferences, or goals mentioned. Extend the following existing summary: ${summary}`;
    
    const messagesToSummarize = messages.slice(0, -2);
    
    const summarizationModel = new ChatOllama({
      model: 'llama3.1',
      temperature: 0,
    });
    
    const response = await summarizationModel.invoke([...messagesToSummarize, new HumanMessage(summaryPrompt)]);
    
    const deleteMessages = messagesToSummarize.map((m) => new RemoveMessage({ id: m.id }));
    
    return {
      summary: response.content,
      messages: deleteMessages
    };
  };

  const callModel = async (state) => {
    const { messages, summary, preferences } = state;
    let systemPrompt = "You are a helpful AI Nutrition Assistant. Use tools to log meals and check goals.";
    
    if (preferences && Object.keys(preferences).length > 0) {
      systemPrompt += `\nUser Permanent Preferences: ${JSON.stringify(preferences)}`;
    }
    
    let currentMessages = [new SystemMessage(systemPrompt)];
    if (summary) {
      currentMessages.push(new SystemMessage(`Summary of previous conversation: ${summary}`));
    }
    
    currentMessages = currentMessages.concat(messages);
    
    const response = await model.invoke(currentMessages);
    return { messages: [response] };
  };

  const shouldContinue = (state) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return "tools";
    }
    return END;
  };

  const workflow = new StateGraph(AgentState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addNode("summarize_conversation", summarizeConversation)
    .addConditionalEdges(START, shouldSummarize)
    .addEdge("summarize_conversation", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return workflow;
};
