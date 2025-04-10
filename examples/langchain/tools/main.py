from dotenv import load_dotenv
from pprint import pprint

from langchain_community.utilities import GoogleSerperAPIWrapper
from langchain_experimental.utilities import PythonREPL
from langchain_community.utilities import ArxivAPIWrapper

load_dotenv()


google_serper_tool = GoogleSerperAPIWrapper(hl="en", gl="us", k=5)
python_repl_tool = PythonREPL()
arxiv_tool = ArxivAPIWrapper(top_k_results=2, doc_content_chars_max=40000)