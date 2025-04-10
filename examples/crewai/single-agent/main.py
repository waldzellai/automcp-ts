# https://www.datacamp.com/tutorial/crew-ai?utm_source=chatgpt.com

from crewai import Agent, Task, Crew
from crewai_tools import ScrapeWebsiteTool

tool = ScrapeWebsiteTool(website_url='https://en.wikipedia.org/wiki/Artificial_intelligence')  

# Define the agent with a static goal
data_analyst = Agent(
    role='Educator',
    goal='Based on the context provided, answer the input question',
    backstory='You are a data expert',
    verbose=True,
    allow_delegation=False,
    tools=[tool]
)

# Task uses a placeholder for the topic
test_task = Task(
    description="Use the tool to research and answer the question: '{{ topic }}'",
    tools=[tool],
    agent=data_analyst,
    expected_output='A clear and informative answer to the input topic'
)