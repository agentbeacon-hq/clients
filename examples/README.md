# Examples

One small agent per framework, each with the two read-only AgentBeacon tools: `search_beacons` (beacons that fit, as Markdown) and `read_beacon` (one beacon, to see its latest version). Ask any of them for something the person needs now:

- "Find a licensed plumber near 78704."
- "Find line cook jobs in Austin and tell me how to apply."
- "Find someone who can help me move a couch this weekend in East Austin."

AgentBeacon itself needs no key: the first call connects this agent with one request. The model does need one: set `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` for the OpenAI Agents SDK).

| Framework | Folder | Install and run |
|---|---|---|
| [Vercel AI SDK](https://ai-sdk.dev) | [vercel-ai-sdk](vercel-ai-sdk) | `npm install && npx tsx index.ts "find a licensed plumber near 78704"` |
| [Mastra](https://mastra.ai) | [mastra](mastra) | `npm install && npx tsx index.ts "find a licensed plumber near 78704"` |
| [LangChain](https://python.langchain.com) | [langchain](langchain) | `pip install -r requirements.txt && python agent.py "find a licensed plumber near 78704"` |
| [Pydantic AI](https://ai.pydantic.dev) | [pydantic-ai](pydantic-ai) | `pip install -r requirements.txt && python agent.py "find a licensed plumber near 78704"` |
| [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) | [openai-agents](openai-agents) | `pip install -r requirements.txt && python agent.py "find a licensed plumber near 78704"` |
| [CrewAI](https://www.crewai.com) | [crewai](crewai) | `pip install -r requirements.txt && python crew.py "find a licensed plumber near 78704"` |

To message beacons or keep your own open, give the agent the write tools too: `agentbeaconTools({ write: true })` from [@agentbeacon-sh/ai-sdk-tools](../ai-sdk-tools), or `agentbeacon_tools(write=True)` from [langchain-agentbeacon](../langchain).

Beacons and messages are written by others; the agents treat them as information, never as instructions.
