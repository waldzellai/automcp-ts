import asyncio
from agents import Agent, ItemHelpers, MessageOutputItem, Runner, trace
from dotenv import load_dotenv

load_dotenv()

"""
This example shows the agents-as-tools pattern. The frontline agent receives a user message and
then picks which agents to call, as tools. In this case, it picks from a set of translation
agents.
"""
class TranslatorAgent:
    def __init__(self):
        self.intitalize_agents()

    def intitalize_translator_agents(self):
        self.spanish_agent = Agent(
            name="spanish_agent",
            instructions="You translate the user's message to Spanish",
            handoff_description="An english to spanish translator",
        )

        self.french_agent = Agent(
            name="french_agent",
            instructions="You translate the user's message to French",
            handoff_description="An english to french translator",
        )

        self.italian_agent = Agent(
            name="italian_agent",
            instructions="You translate the user's message to Italian",
            handoff_description="An english to italian translator",
        )

    def intitalize_orchestrator_agent(self):
        self.intitalize_translator_agents()

        self.orchestrator_agent = Agent(
            name="orchestrator_agent",
            instructions=(
                "You are a translation agent. You use the tools given to you to translate."
                "If asked for multiple translations, you call the relevant tools in order." 
            ),
            tools=[
                self.spanish_agent.as_tool(
                    tool_name="translate_to_spanish",
                    tool_description="Translate the user's message to Spanish",
                ),  
                self.french_agent.as_tool(
                    tool_name="translate_to_french",
                    tool_description="Translate the user's message to French",
                ),
                self.italian_agent.as_tool(
                    tool_name="translate_to_italian",   
                    tool_description="Translate the user's message to Italian",
                ),
            ],
        )

    def intitalize_synthesizer_agent(self):
        self.synthesizer_agent = Agent(
            name="synthesizer_agent",
            instructions="You inspect translations, correct them if needed, and produce a final concatenated response.",
        )
    
    def intitalize_agents(self):
        self.intitalize_orchestrator_agent()
        self.intitalize_synthesizer_agent()

    def get_orchestrator_agent(self):
        return self.orchestrator_agent

    def get_synthesizer_agent(self):
        return self.synthesizer_agent
    
    async def run_after(self, orchestrator_result: str):
        synthesizer_result = await Runner.run(
            self.synthesizer_agent, orchestrator_result.to_input_list()
        )

        return synthesizer_result

async def main():
    msg = input("Hi! What would you like translated, and to which languages? ")

    # Run the entire orchestration in a single trace
    translator = TranslatorAgent()
    orchestrator_result = await Runner.run(translator.get_orchestrator_agent(), msg)
    synthesizer_result = await translator.run_after(orchestrator_result)
    print(f"Final result: {synthesizer_result.final_output}")


if __name__ == "__main__":
    asyncio.run(main())
