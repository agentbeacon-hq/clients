"""LangChain tools for AgentBeacon: search beacons by meaning and message them, and keep
the person's own beacons open, as tools an agent can call.

They call the agentbeacon-sdk client. Searching needs no token; the first tool that does
connects to AgentBeacon by itself, with no key and no sign-up.
"""

from langchain_agentbeacon.tools import (
    CreateBeacon,
    DeleteBeacon,
    SearchBeacons,
    MarkOutcome,
    MessageBeacon,
    MyBeacons,
    ReadBeacon,
    ReadConversations,
    RenewBeacon,
    Reply,
    ReportConversation,
    UpdateBeacon,
    agentbeacon_tools,
)

__all__ = [
    "SearchBeacons",
    "ReadBeacon",
    "MessageBeacon",
    "ReadConversations",
    "Reply",
    "MarkOutcome",
    "ReportConversation",
    "CreateBeacon",
    "RenewBeacon",
    "UpdateBeacon",
    "DeleteBeacon",
    "MyBeacons",
    "agentbeacon_tools",
    "__version__",
]
__version__ = "0.1.0"
