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

async def run_spanish_agent(msg: str):
    spanish_agent = SpanishAgent()
    result = await Runner.run(spanish_agent.get_agent(), msg)
    return result.final_output

if __name__ == "__main__":
    msg = input("Hi! What would you like translated? ")
    result = asyncio.run(run_spanish_agent(msg))
    print(result)