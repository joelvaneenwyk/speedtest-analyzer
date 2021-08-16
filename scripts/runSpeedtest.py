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
import traceback

from speedtest import Speedtest

CSV_FIELDNAMES = ["timestamp", "ping", "download", "upload"]
FILEPATH = os.path.dirname(os.path.abspath(__file__)) + '/../data/result.csv'


def findPythonExecutable() -> str:
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
        '/usr/local/bin/',
        os.path.expanduser('~/local/bin'),
        '/bin/'
    ]

    executables = []
    for option in options:
        for variant in ['python3.9', 'python3', 'python']:
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

    print('--- Starting speedtest ---')

    returncode = 0
    servers = []
    threads = None

    # Execute speedtest
    try:
        if not sys.executable:
            sys.executable = findPythonExecutable()
            print("Overrode system Python executable: '%s'" % sys.executable)
        else:
            print("System Python executable: '%s'" % sys.executable)

        test = Speedtest()
        test.get_servers(servers)
        test.get_best_server()
        test.download(threads=threads)
        test.upload(threads=threads, pre_allocate=False)

        result = test.results.dict()

        # collect speedtest data
        ping = round(result['ping'], 2)
        download = round(result['download'] / 1000 / 1000, 2)
        upload = round(result['upload'] / 1000 / 1000, 2)
        timestamp = round(time.time() * 1000, 3)

        csv_data_dict = {
            CSV_FIELDNAMES[0]: timestamp,
            CSV_FIELDNAMES[1]: ping,
            CSV_FIELDNAMES[2]: download,
            CSV_FIELDNAMES[3]: upload}

        # Write testdata to file
        isFileEmpty = not os.path.isfile(
            FILEPATH) or os.stat(FILEPATH).st_size == 0

        with open(FILEPATH, "a") as f:
            csv_writer = csv.DictWriter(
                f, delimiter=',', lineterminator='\n', fieldnames=CSV_FIELDNAMES)

            if isFileEmpty:
                csv_writer.writeheader()

            csv_writer.writerow(csv_data_dict)

        # print testdata
        print('--- Result ---')
        print("Timestamp: %s" % (timestamp))
        print("Ping: %d [ms]" % (ping))
        print("Download: %d [Mbit/s]" % (download))
        print("Upload: %d [Mbit/s]" % (upload))
        print('--- Speedtest complete ---')
    except Exception:
        print('---! Speedtest failed !---')
        print(traceback.format_exc())
        returncode = 1

    return returncode


if __name__ == '__main__':
    sys.exit(runSpeedtest())
