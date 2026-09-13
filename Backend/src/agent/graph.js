import { Annotation, StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { ChatOllama } from '@langchain/ollama';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { SystemMessage, HumanMessage, RemoveMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { createTools } from './tools.js';

export const createAgentGraph = async (nutritionService, authService) => {
  const [
    logMealTool, 
    queryNutritionTool, 
    checkGoalsTool, 
    savePermanentPreferenceTool,
    setHealthGoalsTool,
    listRecentMealsTool,
    getWeeklySummaryTool
  ] = createTools(nutritionService, authService);

  const mealTools = [logMealTool];
  const analyticsTools = [queryNutritionTool, checkGoalsTool, listRecentMealsTool, getWeeklySummaryTool];
  const profileTools = [savePermanentPreferenceTool, setHealthGoalsTool];

  const mealToolNode = new ToolNode(mealTools);
  const analyticsToolNode = new ToolNode(analyticsTools);
  const profileToolNode = new ToolNode(profileTools);
  
  const routingSchema = z.object({
    next: z.enum(["MEAL_LOGGER", "ANALYTICS", "PROFILE", "CHITCHAT", "FINISH"])
      .describe("Select the next specialist to handle the request, or FINISH if all user requests have been addressed.")
  });

  const supervisorModel = new ChatOllama({
    model: 'llama3.1',
    temperature: 0,
  }).withStructuredOutput(routingSchema);

  const mealModel = new ChatOllama({ model: 'llama3.1', temperature: 0 }).bindTools(mealTools);
  const analyticsModel = new ChatOllama({ model: 'llama3.1', temperature: 0 }).bindTools(analyticsTools);
  const profileModel = new ChatOllama({ model: 'llama3.1', temperature: 0 }).bindTools(profileTools);
  const chitchatModel = new ChatOllama({ model: 'llama3.1', temperature: 0 });

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
    }),
    nextWorker: Annotation({
      reducer: (x, y) => y || x || "",
      default: () => ""
    })
  });

  const shouldSummarize = (state) => {
    if (state.messages.length > 6) {
      return "summarize_conversation";
    }
    return "supervisor";
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

  const supervisor = async (state) => {
    const { messages, summary } = state;
    let currentMessages = [
      new SystemMessage(
        "You are a routing supervisor. Route the user's message to the appropriate specialist:\n" +
        "- MEAL_LOGGER: For logging food or meals and macro estimation.\n" +
        "- ANALYTICS: For checking goals, weekly summaries, reading recent meals, or daily nutrition data.\n" +
        "- PROFILE: For setting health goals, diets, allergies, and permanent preferences.\n" +
        "- CHITCHAT: For warm greetings, motivation, and general nutrition advice without tool requirements.\n" +
        "- FINISH: If the user's query has been fully addressed."
      )
    ];
    if (summary) {
      currentMessages.push(new SystemMessage(`Summary of previous conversation: ${summary}`));
    }
    currentMessages = currentMessages.concat(messages);

    const response = await supervisorModel.invoke(currentMessages);
    return { nextWorker: response.next };
  };

  const getLocalDate = (timeZone) => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    } catch(e) {
      return new Date().toISOString().split('T')[0];
    }
  };

  const mealLoggerNode = async (state) => {
    const { messages, summary, preferences, timeZone } = state;
    const localDate = getLocalDate(timeZone);
    let systemPrompt = `You are a specialist Meal Logger for Macrolytics.
1. When the user tells you what they ate and provides ANY rough quantity (e.g., "2 rotis", "a bowl of rice", "1 apple"), you MUST immediately execute the 'log_meal' tool. 
2. DO NOT ask for exact grams or clarifications if they provide a standard portion (like a cup, a piece, or a bowl). Calculate it using the tool immediately.
3. Only ask for clarification if they mention a food with absolutely zero quantity context (e.g., "I ate rice").
4. You MUST calculate the estimated calories, protein, carbs, and fat yourself before calling the log_meal tool. Never ask the user for the macros, and NEVER pass 0 for macros unless the food is something like water.

The user's current local date is ${localDate}. When calling the log_meal tool, explicitly pass this date.`;

    if (preferences && Object.keys(preferences).length > 0) {
      systemPrompt += `\nUser Permanent Preferences: ${JSON.stringify(preferences)}`;
    }
    
    let currentMessages = [new SystemMessage(systemPrompt)];
    if (summary) {
      currentMessages.push(new SystemMessage(`Summary of previous conversation: ${summary}`));
    }
    currentMessages = currentMessages.concat(messages);
    
    const response = await mealModel.invoke(currentMessages);
    return { messages: [response] };
  };

  const analyticsNode = async (state) => {
    const { messages, summary, preferences, timeZone } = state;
    const localDate = getLocalDate(timeZone);
    let systemPrompt = `You are an Analytics Specialist for Macrolytics. You can read data, query nutrition, check goals, and get weekly summaries.
The user's current local date is ${localDate}.`;

    if (preferences && Object.keys(preferences).length > 0) {
      systemPrompt += `\nUser Permanent Preferences: ${JSON.stringify(preferences)}`;
    }
    
    let currentMessages = [new SystemMessage(systemPrompt)];
    if (summary) {
      currentMessages.push(new SystemMessage(`Summary of previous conversation: ${summary}`));
    }
    currentMessages = currentMessages.concat(messages);
    
    const response = await analyticsModel.invoke(currentMessages);
    return { messages: [response] };
  };

  const profileNode = async (state) => {
    const { messages, summary, preferences } = state;
    let systemPrompt = `You are a Profile Specialist for Macrolytics. You manage the user's permanent preferences, diets, allergies, and health goals.`;
    
    if (preferences && Object.keys(preferences).length > 0) {
      systemPrompt += `\nUser Permanent Preferences: ${JSON.stringify(preferences)}`;
    }
    
    let currentMessages = [new SystemMessage(systemPrompt)];
    if (summary) {
      currentMessages.push(new SystemMessage(`Summary of previous conversation: ${summary}`));
    }
    currentMessages = currentMessages.concat(messages);
    
    const response = await profileModel.invoke(currentMessages);
    return { messages: [response] };
  };

  const chitchatNode = async (state) => {
    const { messages, summary, preferences } = state;
    let systemPrompt = `You are a warm conversationalist for Macrolytics. You handle greetings, general nutrition FAQs, and motivational talk. You don't have tools. Keep it concise.`;

    if (preferences && Object.keys(preferences).length > 0) {
      systemPrompt += `\nUser Permanent Preferences: ${JSON.stringify(preferences)}`;
    }
    
    let currentMessages = [new SystemMessage(systemPrompt)];
    if (summary) {
      currentMessages.push(new SystemMessage(`Summary of previous conversation: ${summary}`));
    }
    currentMessages = currentMessages.concat(messages);
    
    const response = await chitchatModel.invoke(currentMessages);
    return { messages: [response] };
  };

  const routeFromMeal = (state) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.tool_calls?.length > 0) {
      return "meal_tool_node";
    }
    return "supervisor";
  };

  const routeFromAnalytics = (state) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.tool_calls?.length > 0) {
      return "analytics_tool_node";
    }
    return "supervisor";
  };

  const routeFromProfile = (state) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.tool_calls?.length > 0) {
      return "profile_tool_node";
    }
    return "supervisor";
  };

  const supervisorRouter = (state) => {
    const { nextWorker } = state;
    if (nextWorker === "MEAL_LOGGER") return "meal_logger";
    if (nextWorker === "ANALYTICS") return "analytics";
    if (nextWorker === "PROFILE") return "profile";
    if (nextWorker === "CHITCHAT") return "chitchat";
    return END;
  };

  const workflow = new StateGraph(AgentState)
    .addNode("supervisor", supervisor)
    .addNode("meal_logger", mealLoggerNode)
    .addNode("analytics", analyticsNode)
    .addNode("profile", profileNode)
    .addNode("chitchat", chitchatNode)
    .addNode("meal_tool_node", mealToolNode)
    .addNode("analytics_tool_node", analyticsToolNode)
    .addNode("profile_tool_node", profileToolNode)
    .addNode("summarize_conversation", summarizeConversation)
    .addConditionalEdges(START, shouldSummarize)
    .addEdge("summarize_conversation", "supervisor")
    .addConditionalEdges("supervisor", supervisorRouter)
    .addConditionalEdges("meal_logger", routeFromMeal)
    .addConditionalEdges("analytics", routeFromAnalytics)
    .addConditionalEdges("profile", routeFromProfile)
    .addEdge("meal_tool_node", "meal_logger")
    .addEdge("analytics_tool_node", "analytics")
    .addEdge("profile_tool_node", "profile")
    .addEdge("chitchat", END);

  return workflow;
};
