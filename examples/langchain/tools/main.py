from dotenv import load_dotenv
from pprint import pprint

from langchain_community.utilities import GoogleSerperAPIWrapper
from langchain_experimental.utilities import PythonREPL
from langchain_community.utilities import ArxivAPIWrapper

load_dotenv()

def search_google(query: str, num_results: int = 5, hl: str = "en", gl: str = "us"):
    """Search Google for a query"""
    search = GoogleSerperAPIWrapper(hl=hl, gl=gl, k=num_results)
    results = search.results(query)
    results = results["organic"]

    extracted_results = []
    for result in results:
        extracted_results.append({
            "title": result["title"],
            "link": result["link"],
            "snippet": result["snippet"]
        })
    return extracted_results


def run_python_code(code: str):
    """Run Python code"""
    repl = PythonREPL()
    return repl.run(code)


def search_arxiv(query: str, num_results: int = 2):
    """Search Arxiv for a query"""
    arxiv = ArxivAPIWrapper(
        top_k_results=num_results,     
        doc_content_chars_max = 40000
    )
    results = arxiv.load(query)
    return [res.model_dump() for res in results]


# if __name__ == "__main__":
    # pprint(search_google("What is the capital of France?"))
    # pprint(run_python_code("print('Hello, world!')"))
    # pprint(search_arxiv("KV cache"))
