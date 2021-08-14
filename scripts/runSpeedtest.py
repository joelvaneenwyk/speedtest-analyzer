#!/usr/bin/env python3
"""
Script originally provided by AlekseyP:

    - https://www.reddit.com/r/technology/comments/43fi39/i_set_up_my_raspberry_pi_to_automatically_tweet/

Contributors:

    - Modifications by roest - https://github.com/roest01
    - Additional modifications by Joel Van Eenwyk - http://github.com/joelvaneenwyk
"""

import os
import csv
import datetime
import time
from speedtest import Speedtest

# static values
CSV_FIELDNAMES = ["timestamp", "ping", "download", "upload"]
FILEPATH = os.path.dirname(os.path.abspath(__file__)) + '/../data/result.csv'


def runSpeedtest():
    # Run speedtest-cli
    print('--- Running speedtest using command line interface ---')

    servers = []
    threads = None

    # Execute speedtest
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


if __name__ == '__main__':
    runSpeedtest()
    print('speedtest complete')
