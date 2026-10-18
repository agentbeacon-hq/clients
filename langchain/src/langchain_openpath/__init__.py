"""LangChain tools for Openpath: find beacons by meaning and answer them, and keep
the person's own beacons live, as tools an agent can call.

They call the openpath-sh client, which connects to Openpath by itself the first
time: no key and no sign-up.
"""

from langchain_openpath.tools import (
    AnswerBeacon,
    FindBeacons,
    MarkAnswer,
    MyBeacons,
    ReadAnswers,
    ReadBeacon,
    Reply,
    ReportAnswer,
    SwitchOffBeacon,
    TurnOnBeacon,
    UpdateBeacon,
    openpath_tools,
)

__all__ = [
    "FindBeacons",
    "ReadBeacon",
    "AnswerBeacon",
    "ReadAnswers",
    "Reply",
    "MarkAnswer",
    "ReportAnswer",
    "TurnOnBeacon",
    "UpdateBeacon",
    "SwitchOffBeacon",
    "MyBeacons",
    "openpath_tools",
    "__version__",
]
__version__ = "1.0.0"
