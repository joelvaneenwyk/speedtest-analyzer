#!/usr/bin/env python3
"""
Script originally provided by AlekseyP:

    - https://www.reddit.com/r/technology/comments/43fi39/i_set_up_my_raspberry_pi_to_automatically_tweet/

Contributors:

    - Modifications by roest - https://github.com/roest01
    - Additional modifications by Joel Van Eenwyk - http://github.com/joelvaneenwyk
"""

import csv
import os
import sys
import time
import argparse
import traceback
from typing import Optional, List
from datetime import datetime
import calendar

from speedtest import Speedtest


def findPythonExecutable() -> Optional[str]:
    """
    In some cases, the `sys.executable` path is not set. This causes problems in some library
    functions like `platform.platform()` which relies on the executable to find the current version
    of `libc` system library. The results of that are used by the speedtest library for building
    the user agent (`build_user_agent`). This helper utility finds the most recent installed version
    of Python so that it can be used to override `sys.executable` in these cases.

    For reference, this is the error addressed:

        - `IsADirectoryError: [Errno 21] Is a directory: '/usr/share/nginx/html'`
    """

    pythonExecutable = None
    options = [
        "/usr/bin/",
        "/usr/local/bin/",
        os.path.expanduser("~/local/bin"),
        "/bin/",
    ]

    executables = [sys.executable]
    for option in options:
        for variant in ["python3.10", "python3.9", "python3.8", "python3", "python"]:
            executables.append(os.path.join(option, variant))

    for executable in executables:
        if os.path.exists(executable):
            pythonExecutable = executable
            break

    return pythonExecutable


def runSpeedtest() -> int:
    """
    Run speedtest-cli manually by calling directly into API.
    """

    print("--- Starting speedtest ---")

    returncode = 0

    # Execute speedtest
    try:
        csvFieldNames = ["timestamp", "ping", "download", "upload"]
        dataRoot = os.path.abspath(
            "%s/../../html/data/" % os.path.dirname(os.path.abspath(__file__))
        )
        outputFilePath = os.path.join(dataRoot, "result.csv")
        os.makedirs(dataRoot, exist_ok=True)

        executable = findPythonExecutable()

        if not sys.executable:
            if not executable:
                print("ERROR: Failed to find Python executable.")
            else:
                sys.executable = executable
                print("Overrode system Python executable: '%s'" % sys.executable)
        else:
            print("System Python executable: '%s'" % sys.executable)

        parser = argparse.ArgumentParser(description="Run speedtest.")
        parser.add_argument(
            "--initialize",
            dest="initialize",
            action="store_true",
            help="Whether to initialize output file.",
        )
        args = parser.parse_args()

        csv_data_dict = {}
        ping = 0
        download = 0
        upload = 0

        # Convert to milliseconds
        timestamp = datetime.utcnow().timestamp() * 1000.0

        test = Speedtest()

        if not args.initialize:
            print("Finding servers to test...")
            test.get_servers(None)
            test.get_best_server()
            print("Testing download...")
            test.download(threads=None)
            print("Testing upload...")
            test.upload(threads=None, pre_allocate=False)

            result = test.results.dict()

            # collect speedtest data
            ping = round(result["ping"], 2)
            download = round(result["download"] / 1000 / 1000, 2)
            upload = round(result["upload"] / 1000 / 1000, 2)

            csv_data_dict = {
                csvFieldNames[0]: timestamp,
                csvFieldNames[1]: ping,
                csvFieldNames[2]: download,
                csvFieldNames[3]: upload,
            }

        with open(outputFilePath, "a") as outputFileStream:
            csv_writer = csv.DictWriter(
                outputFileStream,
                delimiter=",",
                lineterminator="\n",
                fieldnames=csvFieldNames,
            )

            if outputFileStream.tell() == 0:
                csv_writer.writeheader()

            if csv_data_dict:
                csv_writer.writerow(csv_data_dict)

        # Print results from test run
        print("--- Result ---")
        print("Timestamp: %s" % (timestamp))
        print("Ping: %d [ms]" % (ping))
        print("Download: %d [Mbit/s]" % (download))
        print("Upload: %d [Mbit/s]" % (upload))
        print("--- Speedtest complete ---")
    except Exception:
        print("---! Speedtest failed !---")
        print(traceback.format_exc())
        returncode = 1

    return returncode


if __name__ == "__main__":
    sys.exit(runSpeedtest())
