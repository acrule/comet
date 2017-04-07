# Comet
Comet is a Jupyter Notebook extension that tracks changes to the notebook over time. It works in tandem with the [Comet server extension](https://github.com/activityhistory/comet_server). You must have both the server and notebook extension installed for the tracking to work properly since the notebook extension listens for events and send information to the server for processing.

## What Comet Tracks
Comet tracks how your notebook changes over time. It does so by:
1. tracking actions such as creating, deleting, moving, or executing cells
2. tracking how your notebook changes as a result of these actions

Comet tracks this information in three ways:
1. committing every notebook change to a local git repository
2. periodically saving a full version of the notebook
3. saving the name and time of every action to an sqlite database

## Installation
Comet is a research tool designed to help scientists in human-computer interaction better understand how Jupyter Notebooks  evolve over time. It is primarily a recording tool with very limited support for visualizing or reviewing the recorded data.

Comet expects all data to be saved to an external drive (e.g. a USB key) and will not run unless it detects a mounted drive with a config file named `traces.cfg`.

The Comet notebook extension may be installed by downloading this repo, opening a terminal, navigating to the folder containing the downloaded extension, and then installing and enabling the extension using the following commands:

```
jupyter nbextension install comet
jupyter nbextension enable comet/main
```

See the [Comet Server repo](https://github.com/activityhistory/comet_server) for instructions on how to install the server extension.
