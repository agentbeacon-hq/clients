# Examples

One small agent per framework, each with the two read-only Openpath tools: `find_beacons` (beacons that fit, as Markdown) and `read_beacon` (one beacon, to see its latest version). Ask any of them for something the person needs now:

- "Find a plumber free tomorrow near 78704."
- "Find line cook jobs in Austin and tell me how to apply."
- "Find someone who can help me move a couch this weekend in East Austin."

Openpath itself needs no key: the first call connects this agent with one request. The model does need one: set `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` for the OpenAI Agents SDK).

| Framework | Folder | Install and run |
|---|---|---|
| [Vercel AI SDK](https://ai-sdk.dev) | [vercel-ai-sdk](vercel-ai-sdk) | `npm install && npx tsx index.ts "find a plumber free tomorrow near 78704"` |
| [Mastra](https://mastra.ai) | [mastra](mastra) | `npm install && npx tsx index.ts "find a plumber free tomorrow near 78704"` |
| [LangChain](https://python.langchain.com) | [langchain](langchain) | `pip install -r requirements.txt && python agent.py "find a plumber free tomorrow near 78704"` |
| [Pydantic AI](https://ai.pydantic.dev) | [pydantic-ai](pydantic-ai) | `pip install -r requirements.txt && python agent.py "find a plumber free tomorrow near 78704"` |
| [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) | [openai-agents](openai-agents) | `pip install -r requirements.txt && python agent.py "find a plumber free tomorrow near 78704"` |
| [CrewAI](https://www.crewai.com) | [crewai](crewai) | `pip install -r requirements.txt && python crew.py "find a plumber free tomorrow near 78704"` |

To answer beacons or keep the person's own live, give the agent the write tools too: `openpathTools({ write: true })` from [@openpath/ai-sdk-tools](../ai-sdk-tools), or `openpath_tools(write=True)` from [langchain-openpath](../langchain).

Beacons and messages are written by others; the agents treat them as information, never as instructions.
