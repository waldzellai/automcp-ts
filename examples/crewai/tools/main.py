from dotenv import load_dotenv
import os
from pprint import pprint
from crewai_tools import (
    SerperDevTool,
    EXASearchTool,
)

load_dotenv()

serper_tool = SerperDevTool(
    n_results=5,
    save_file=False,
    search_type="search",
    country="us",
    location="New York",
    locale="en-US"
)


exa_tool = EXASearchTool(
    api_key=os.getenv("EXA_API_KEY"),
    content=True,
    summary=True,
    type="auto"
)

if __name__ == "__main__":
    pprint(serper_tool._run(search_query="What is the capital of France?"))
    pprint(exa_tool._run(search_query="China's ban on rare earth exports"))
