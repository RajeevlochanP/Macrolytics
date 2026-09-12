import { Annotation, StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
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

  const AgentState = Annotation.Root({
    ...MessagesAnnotation.spec,
    summary: Annotation({
      reducer: (x, y) => y || x || "",
      default: () => ""
    }),
    preferences: Annotation({
      reducer: (x, y) => y || x || {},
      default: () => ({})
    }),
    timeZone: Annotation({
      reducer: (x, y) => y || x || 'UTC',
      default: () => 'UTC'
    })
  });

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
    const { messages, summary, preferences, timeZone } = state;
    
    // Compute the user's explicit local date
    let localDate = 'YYYY-MM-DD';
    try {
      localDate = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    } catch(e) {
      localDate = new Date().toISOString().split('T')[0];
    }
    
    let systemPrompt = `You are Macrolytics, a helpful and precise AI nutrition assistant. 
1. If the user greets you, greet them back warmly. DO NOT ask about food unless they bring it up.
2. You have access to a 'log_meal' tool. 
3. When the user tells you what they ate and provides ANY rough quantity (e.g., "2 rotis", "a bowl of rice", "1 apple"), you MUST immediately execute the 'log_meal' tool. 
4. DO NOT ask for exact grams or clarifications if they provide a standard portion (like a cup, a piece, or a bowl). Calculate it using the tool immediately.
5. Only ask for clarification if they mention a food with absolutely zero quantity context (e.g., "I ate rice").
6. You are an expert nutritional database. When a user tells you what they ate, you MUST calculate the estimated calories, protein, carbs, and fat yourself before calling the log_meal tool. Never ask the user for the macros, and NEVER pass 0 for macros unless the food is something like water.

The user's current local date is ${localDate}. When calling the log_meal tool, explicitly pass this date.`;
    
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
