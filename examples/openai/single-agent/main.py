from agents import Agent, Runner
import asyncio
from dotenv import load_dotenv

load_dotenv()

class SpanishAgent:
    def __init__(self):
        self.agent = Agent(
            name="spanish_agent",
            instructions="You translate the user's message to Spanish",
            handoff_description="A spanish translator"
        )

    def get_agent(self):
        return self.agent

if __name__ == "__main__":
    msg = input("Hi! What would you like translated? ")
    result = asyncio.run(Runner.run(SpanishAgent().get_agent(), msg))
    print(result.final_output)