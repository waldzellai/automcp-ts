from dotenv import load_dotenv
import os
from pprint import pprint
from crewai_tools import (
    SerperDevTool,
    EXASearchTool,
)

load_dotenv()

def search_google_tool(query: str, n_results: int = 10, country: str = "us", location: str = "New York", locale: str = "en-US"):
    """Search Google for a query"""
    tool = SerperDevTool(
        n_results=n_results,  # Optional: Number of results to return (default: 10)
        save_file=False,  # Optional: Save results to file (default: False)
        search_type="search",  # Optional: Type of search - "search" or "news" (default: "search")
        country=country,  # Optional: Country for search (default: "")
        location=location,  # Optional: Location for search (default: "")
        locale=locale  # Optional: Locale for search (default: "")
    )

    results = tool._run(search_query=query)

    # Extract the results
    results = results["organic"]
    extracted_results = []
    for result in results:
        extracted_results.append({
            "title": result["title"],
            "link": result["link"],
            "snippet": result["snippet"]
        })
    return extracted_results


def search_exa_tool(query: str):
    """Search Exa for a query"""
    tool = EXASearchTool(
        api_key=os.getenv("EXA_API_KEY"),
        content=True,
        summary=True,
        type="auto"
    )

    results = tool._run(search_query=query)

    extracted_results = []
    for result in results.results:
        extracted_results.append({
            "title": result.title,
            "url": result.url,
            "summary": result.summary
        })
    return extracted_results


if __name__ == "__main__":
    pprint(search_google_tool("What is the capital of France?"))
    pprint(search_exa_tool("China's ban on rare earth exports"))
