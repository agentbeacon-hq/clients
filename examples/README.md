# Examples

One small agent per framework, each with two tools: `search_listings` (live listings, as Markdown) and `read_listing` (one listing in full). Ask any of them for a job to apply to or a business to reach:

- "Find me a data engineer job in Austin, TX and give me the link to apply."
- "Find a plumber near Austin, TX who can come today."
- "Find taco places in Austin, TX and tell me how to reach them."

Openpath itself needs no key: the first search connects this agent with one request. The model does need one: set `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` for the OpenAI Agents SDK).

| Framework | Folder | Install and run |
|---|---|---|
| [Vercel AI SDK](https://ai-sdk.dev) | [vercel-ai-sdk](vercel-ai-sdk) | `npm install && npx tsx index.ts "find a plumber near Austin, TX"` |
| [Mastra](https://mastra.ai) | [mastra](mastra) | `npm install && npx tsx index.ts "find a plumber near Austin, TX"` |
| [LangChain](https://python.langchain.com) | [langchain](langchain) | `pip install -r requirements.txt && python agent.py "find a plumber near Austin, TX"` |
| [Pydantic AI](https://ai.pydantic.dev) | [pydantic-ai](pydantic-ai) | `pip install -r requirements.txt && python agent.py "find a plumber near Austin, TX"` |
| [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) | [openai-agents](openai-agents) | `pip install -r requirements.txt && python agent.py "find a plumber near Austin, TX"` |
| [CrewAI](https://www.crewai.com) | [crewai](crewai) | `pip install -r requirements.txt && python crew.py "find a plumber near Austin, TX"` |

Checked on October 13, 2026 against ai 7.0.138, @mastra/core 1.76.0, langchain 1.4.5, pydantic-ai 2.55.0, openai-agents 0.23.1 and crewai 1.15.27: each tool returns live results, and each agent runs through to the model call.

Results are written by the businesses and people who offer them; the agents treat them as information, not instructions.
