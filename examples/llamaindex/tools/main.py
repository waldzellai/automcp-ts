from llama_index.core.tools import FunctionTool
from typing import Annotated
import requests
import os
from dotenv import load_dotenv
import asyncio

load_dotenv()

def get_weather(location: Annotated[
        str, "A city name and state, formatted like '<name>, <state>'"
    ]) -> str:
    """Usfeful for getting the weather for a given location."""
    
    if os.getenv('WEATHER_API_KEY') is None:
        return "Weather API key not found"

    response = requests.get(f"https://api.weatherapi.com/v1/current.json?key={os.getenv('WEATHER_API_KEY')}&q={location}")
    data = response.json()
    if data.get("location"):
        return f"The weather in {data['location']['name']} is {data['current']['temp_c']}°C"
    else:
        return "Weather information not found"
    
def get_cat_fact():
    response = requests.get("https://catfact.ninja/fact")
    data = response.json()
    if data.get("fact"):
        return data["fact"]
    else:
        return "Cat fact not found"

def get_joke():
    response = requests.get("https://official-joke-api.appspot.com/random_joke")
    data = response.json()
    if data.get("setup") and data.get("punchline"):
        return f"{data['setup']} {data['punchline']}"
    else:
        return "Joke not found"

def get_weather_tool():
    return FunctionTool.from_defaults(get_weather)

def get_cat_fact_tool():
    return FunctionTool.from_defaults(get_cat_fact)

def get_joke_tool():
    return FunctionTool.from_defaults(get_joke)

if __name__ == "__main__":
    weather_tool = get_weather_tool()
    cat_fact_tool = get_cat_fact_tool()
    joke_tool = get_joke_tool()

    print("Running tools without async")
    print(weather_tool.call("Osaka"))
    print(cat_fact_tool.call())
    print(joke_tool.call())

    print("Running tools with async")
    print(asyncio.run(weather_tool.acall("Osaka")))
    print(asyncio.run(cat_fact_tool.acall()))
    print(asyncio.run(joke_tool.acall()))