# main.py (Modified ReflectionAgent and __main__ block)

from dotenv import load_dotenv
from typing import Annotated, Dict, Any
from langgraph.graph import END, StateGraph, START
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
import asyncio

load_dotenv()

class State(TypedDict):
    messages: Annotated[list, add_messages]

class ReflectionAgent:
    def __init__(self, openai_model: str = "gpt-4o-mini"):
        self.llm = ChatOpenAI(model=openai_model)

        # Set up generation prompt and chain
        self.generate_prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are an essay assistant tasked with writing excellent 5-paragraph essays."
                " Generate the best essay possible for the user's request."
                " If the user provides critique, respond with a revised version of your previous attempts.",
            ),
            MessagesPlaceholder(variable_name="messages"),
        ])
        self.generate = self.generate_prompt | self.llm

        # Set up reflection prompt and chain
        self.reflection_prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "You are a teacher grading an essay submission. Generate critique and recommendations for the user's submission."
                " Provide detailed recommendations, including requests for length, depth, style, etc.",
            ),
            MessagesPlaceholder(variable_name="messages"),
        ])
        self.reflect = self.reflection_prompt | self.llm

        # Store max_iterations as instance attribute, can be updated by run
        self.max_iterations = 3
        # Initialize graph structure - graph definition remains the same
        self._init_graph()

    def generation_node(self, state: State) -> State:
        return {"messages": [self.generate.invoke(state["messages"])]}

    def reflection_node(self, state: State) -> State:
        cls_map = {"ai": AIMessage, "human": HumanMessage}
        translated = [state["messages"][0]] + [
            cls_map[msg.type](content=msg.content) for msg in state["messages"][1:]
        ]
        res = self.reflect.invoke(translated)
        return {"messages": [HumanMessage(content=res.content)]}

    def _init_graph(self):
        builder = StateGraph(State)
        builder.add_node("generate", self.generation_node)
        builder.add_node("reflect", self.reflection_node)
        builder.add_edge(START, "generate")

        # Conditional edge function remains synchronous as it only checks state length
        builder.add_conditional_edges("generate", self.should_continue)
        builder.add_edge("reflect", "generate")
        # Compile the graph - graph object can be used sync or async
        self.graph = builder.compile()

    def should_continue(self, state: State):
        # Use the instance attribute for max_iterations
        if len(state["messages"]) >= self.max_iterations:
            return END
        return "reflect"

    async def run(self, query: str, max_iterations: int = 3) -> Dict[str, Any]:
        """Runs the agent asynchronously using ainvoke."""
        # Update max_iterations from input for this specific run
        self.max_iterations = max_iterations

        initial_state = {
            "messages": [HumanMessage(content=query)],
            "max_iterations": max_iterations
        }

        final_state = await self.graph.ainvoke(initial_state)


        all_messages = final_state["messages"]
        essays = [msg.content for msg in all_messages if isinstance(msg, AIMessage)]
        critiques = [msg.content for msg in all_messages[2:] if isinstance(msg, HumanMessage)] # Assuming first is query, second is first essay

        return {
            "final_essay": essays[-1] if essays else None,
            "all_essays": essays,
            "all_critiques": critiques,
            # Optionally return raw messages if useful for debugging/client
            # "all_messages": all_messages
        }

# ***** MODIFY MAIN EXECUTION BLOCK TO USE ASYNCIO.RUN *****
if __name__ == "__main__":
    import time

    async def main():
        start = time.time()
        agent = ReflectionAgent()
        print("Running ReflectionAgent...")
        res = await agent.run(query="Write an essay on the topicality of The Little Prince and its message in modern life", max_iterations=3)
        print("\n--- Results ---")
        print(f"Final Essay: {res.get('final_essay', 'N/A')[:200]}...") # Print snippet
        # print(res) # Print full result if needed
        end = time.time()
        print(f"\nTime taken: {end - start:.2f} seconds")

    # Run the async main function
    asyncio.run(main())