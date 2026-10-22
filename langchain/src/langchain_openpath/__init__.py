"""LangChain tools for Beacon: search beacons by meaning and message them, and keep
a business's own beacons open, as tools an agent can call.

They call the openpath-sh client. Searching needs no token; the first tool that does
connects to Beacon by itself, with no key and no sign-up.
"""

from langchain_openpath.tools import (
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
    openpath_tools,
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
    "openpath_tools",
    "__version__",
]
__version__ = "0.1.1"
