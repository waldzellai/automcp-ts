from typing import Annotated, Dict, Any, List
from langgraph.graph import END, StateGraph, START
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
import asyncio



class State(TypedDict):
    messages: Annotated[list, add_messages]
    max_iterations: int


# Create LLM and prompt templates
llm = ChatOpenAI(model="gpt-4o-mini")

generate_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an essay assistant tasked with writing excellent 5-paragraph essays."
        " Generate the best essay possible for the user's request."
        " If the user provides critique, respond with a revised version of your previous attempts.",
    ),
    MessagesPlaceholder(variable_name="messages"),
])
generate_chain = generate_prompt | llm

reflection_prompt = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a teacher grading an essay submission. Generate critique and recommendations for the user's submission."
        " Provide detailed recommendations, including requests for length, depth, style, etc.",
    ),
    MessagesPlaceholder(variable_name="messages"),
])
reflect_chain = reflection_prompt | llm


# Define nodes
async def generation_node(state: State) -> State:
    return {"messages": [await generate_chain.ainvoke(state["messages"])]}


async def reflection_node(state: State) -> State:
    # Convert message types for teacher-student interaction
    cls_map = {"ai": HumanMessage, "human": AIMessage}
    # Keep original user request, convert other messages
    translated = [state["messages"][0]] + [
        cls_map[msg.type](content=msg.content) for msg in state["messages"][1:]
    ]
    res = await reflect_chain.ainvoke(translated)
    return {"messages": [HumanMessage(content=res.content)]}


# Create and compile the graph
def create_reflection_graph():
    builder = StateGraph(State)
    builder.add_node("generate", generation_node)
    builder.add_node("reflect", reflection_node)
    builder.add_edge(START, "generate")
    
    # Define conditional edge function
    def should_continue(state: State):
        max_iterations = state.get("max_iterations", 3)
        if len(state["messages"]) >= 1 + 2 * max_iterations:
            return END
        return "reflect"
    
    builder.add_conditional_edges("generate", should_continue)
    builder.add_edge("reflect", "generate")
    
    return builder.compile()


# Create the compiled graph
reflection_graph = create_reflection_graph()


# Function to run the graph with input
async def run_reflection_graph(query: str, max_iterations: int = 3) -> Dict[str, Any]:
    # Set initial state with query and max_iterations
    initial_state = {
        "messages": [HumanMessage(content=query)],
        "max_iterations": max_iterations
    }
    
    # Execute graph and get final state
    final_state = await reflection_graph.ainvoke(initial_state)
    
    # Extract messages by type
    all_messages = final_state["messages"]
    essays = [msg.content for msg in all_messages if isinstance(msg, AIMessage)]
    critiques = [msg.content for msg in all_messages[2:] if isinstance(msg, HumanMessage)]
    
    # Return organized results
    return {
        "final_essay": essays[-1] if essays else None,
        "all_essays": essays,
        "all_critiques": critiques,
        "all_messages": [m.model_dump() for m in all_messages]
    }


def run(query: str, max_iterations: int = 3) -> Dict[str, Any]:
    return asyncio.run(run_reflection_graph(query, max_iterations))